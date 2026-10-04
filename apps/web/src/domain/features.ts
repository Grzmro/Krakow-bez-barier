import type { FeatureFilter, FeatureMatch } from "@krakow-bez-barier/contracts";
import { effectiveDate } from "./resolver";
import type { AccessibilityAttribute, ResolvedAttribute } from "./types";

/** Attributes that satisfy each home-screen feature filter (any one of them is enough). */
export const FEATURE_ATTRIBUTES: Record<FeatureFilter, AccessibilityAttribute[]> = {
  step_free: ["step_count", "ramp", "entrance_level"],
  lift: ["lift"],
  toilet_accessible: ["toilet_accessible"],
  bench: ["bench"],
  disabled_parking: ["disabled_parking"],
  changing_table: ["changing_table"],
};

/** `met`: known to be there; `absent`: known not to be; `stale`: there by outdated data only; `unknown`/`conflict`: we can't say. */
export type FeatureState = FeatureMatch["state"];

type Answer = "yes" | "no" | "stale_yes" | "unknown" | "conflict";

function valueAnswer(attribute: AccessibilityAttribute, value: NonNullable<ResolvedAttribute["value"]>): "yes" | "no" | "unknown" {
  if (attribute === "step_count") return value.kind === "number" ? (value.number === 0 ? "yes" : "no") : "unknown";
  if (value.kind !== "boolean") return "unknown";
  if (attribute === "entrance_level") return value.boolean ? "yes" : "unknown";
  return value.boolean ? "yes" : "no";
}

function answer(attribute: AccessibilityAttribute, resolved: ResolvedAttribute | undefined): Answer {
  if (resolved?.state === "conflict") return "conflict";
  if (!resolved?.value || (resolved.state !== "known" && resolved.state !== "stale")) return "unknown";
  const said = valueAnswer(attribute, resolved.value);
  if (resolved.state === "known") return said;
  // Outdated data never proves a feature or its absence; an outdated "yes" is still worth showing with its date.
  return said === "yes" ? "stale_yes" : "unknown";
}

/** When the newest fact behind an outdated attribute was last true. */
function asOf(resolved: ResolvedAttribute | undefined, now: Date): string | undefined {
  const times = (resolved?.facts ?? []).map((fact) => effectiveDate(fact, now).getTime()).filter((t) => !Number.isNaN(t));
  return times.length ? new Date(Math.max(...times)).toISOString() : undefined;
}

/**
 * How a place answers one feature filter from its resolved values. One alternative that is known (by fresh data) to
 * be there is enough; the feature is absent only when every alternative is known not to be there. An alternative
 * there by outdated data only makes it `stale`, dated, which never counts as met.
 */
export function featureMatch(attributes: ResolvedAttribute[], feature: FeatureFilter, now: Date = new Date()): FeatureMatch {
  const byAttribute = new Map(attributes.map((a) => [a.attribute, a]));
  const alternatives = FEATURE_ATTRIBUTES[feature]
    .map((attribute) => ({ attribute, answer: answer(attribute, byAttribute.get(attribute)) }))
    .filter(({ attribute, answer }) => !(attribute === "entrance_level" && answer === "unknown"));
  const answers = alternatives.map((a) => a.answer);
  if (answers.includes("yes")) return { feature, state: "met" };
  if (answers.includes("conflict")) return { feature, state: "conflict" };
  const stale = alternatives.filter((a) => a.answer === "stale_yes");
  if (stale.length) {
    const dates = stale.map((a) => asOf(byAttribute.get(a.attribute), now)).filter((d): d is string => Boolean(d));
    const latest = dates.toSorted().at(-1);
    return { feature, state: "stale", ...(latest ? { asOf: latest } : {}) };
  }
  if (answers.length > 0 && answers.every((a) => a === "no")) return { feature, state: "absent" };
  return { feature, state: "unknown" };
}

/** Just the state of `featureMatch`. */
export function featureState(attributes: ResolvedAttribute[], feature: FeatureFilter, now: Date = new Date()): FeatureState {
  return featureMatch(attributes, feature, now).state;
}
