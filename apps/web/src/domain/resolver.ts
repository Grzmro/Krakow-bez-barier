import {
  COMMUNITY_CONFIRMATIONS_REQUIRED,
  CONFIRMATION_WINDOW_DAYS,
  RELIABILITY_RANK,
  STALE_AFTER_MONTHS,
} from "./config";
import type {
  AccessibilityAttribute,
  AccessibilityFact,
  FactValue,
  Reliability,
  ReliabilityStatus,
  ResolvedAttribute,
  ResolvedState,
} from "./types";

export function valuesEqual(a: FactValue, b: FactValue): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "boolean":
      return a.boolean === (b as typeof a).boolean;
    case "number":
      return a.number === (b as typeof a).number && (a.unit ?? null) === ((b as typeof a).unit ?? null);
    case "text":
      return a.text === (b as typeof a).text;
  }
}

/** When a fact was last true: its latest confirmation or observation (never in the future), else when it was fetched. */
export function effectiveDate(fact: AccessibilityFact, now: Date): Date {
  const dates = [fact.confirmedAt, fact.observedAt].filter((d): d is string => Boolean(d));
  if (dates.length === 0) return new Date(fact.fetchedAt);
  const latest = Math.max(...dates.map((d) => new Date(d).getTime()));
  return new Date(Math.min(latest, now.getTime()));
}

function monthsAgo(now: Date, months: number): Date {
  const limit = new Date(now);
  const day = limit.getUTCDate();
  limit.setUTCDate(1);
  limit.setUTCMonth(limit.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(limit.getUTCFullYear(), limit.getUTCMonth() + 1, 0)).getUTCDate();
  limit.setUTCDate(Math.min(day, lastDay));
  return limit;
}

export function isStale(fact: AccessibilityFact, now: Date): boolean {
  if (fact.stale) return true;
  const date = effectiveDate(fact, now);
  return Number.isNaN(date.getTime()) || date < monthsAgo(now, STALE_AFTER_MONTHS);
}

function compareFacts(now: Date) {
  return (a: AccessibilityFact, b: AccessibilityFact): number => {
    const byReliability = RELIABILITY_RANK[b.reliability] - RELIABILITY_RANK[a.reliability];
    if (byReliability !== 0) return byReliability;
    return effectiveDate(b, now).getTime() - effectiveDate(a, now).getTime();
  };
}

// Sample and inferred facts can never be promoted by confirmations.
const CONFIRMABLE: Reliability[] = ["community", "extracted", "user_report"];

/** Confirmations of a fact given within the window before `now`; future dates (clock skew) do not count. */
export function recentConfirmations(fact: AccessibilityFact, now: Date): number {
  const from = now.getTime() - CONFIRMATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return (fact.evidence?.confirmationDates ?? []).filter((d) => {
    const time = new Date(d).getTime();
    return time >= from && time <= now.getTime();
  }).length;
}

/**
 * Community confirmation rule: a fact of a confirmable reliability is confirmed once it has
 * COMMUNITY_CONFIRMATIONS_REQUIRED independent confirmations within CONFIRMATION_WINDOW_DAYS; fewer change nothing.
 */
function statusOf(agreeing: AccessibilityFact[], now: Date): ReliabilityStatus {
  if (agreeing.some((f) => f.reliability === "confirmed")) return "confirmed";
  const confirmations = Math.max(
    0,
    ...agreeing.filter((f) => CONFIRMABLE.includes(f.reliability)).map((f) => recentConfirmations(f, now)),
  );
  return confirmations >= COMMUNITY_CONFIRMATIONS_REQUIRED ? "confirmed" : "unverified";
}

/**
 * Resolves all facts of one attribute into what the UI renders.
 * Only `active` facts take part. Any disagreement between fresh facts is a conflict — it is never
 * settled by reliability; stale facts only count when no fresh fact exists.
 */
export function resolveAttribute(
  attribute: AccessibilityAttribute,
  allFacts: AccessibilityFact[],
  now: Date = new Date(),
): ResolvedAttribute {
  const facts = allFacts.filter((f) => f.attribute === attribute && f.status === "active");
  const sorted = [...facts].sort(compareFacts(now));

  if (sorted.length === 0) {
    return { attribute, state: "unknown", status: "no_data", value: null, facts: [] };
  }

  const fresh = sorted.filter((f) => !isStale(f, now));
  const deciding = fresh.length > 0 ? fresh : sorted;
  const best = deciding[0];
  const conflict = deciding.some((f) => !valuesEqual(f.value, best.value));

  if (conflict) {
    return { attribute, state: "conflict", status: "conflict", value: null, facts: sorted };
  }

  const state: ResolvedState = fresh.length > 0 ? "known" : "stale";
  const status: ReliabilityStatus = state === "stale" ? "outdated" : statusOf(deciding, now);
  return { attribute, state, status, value: best.value, facts: sorted };
}

export function resolveAttributes(
  facts: AccessibilityFact[],
  now: Date = new Date(),
): ResolvedAttribute[] {
  const attributes = [...new Set(facts.map((f) => f.attribute))];
  return attributes.map((attribute) => resolveAttribute(attribute, facts, now));
}
