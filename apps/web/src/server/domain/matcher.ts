import type { Need, NeedResult } from "@krakow-bez-barier/contracts";
import { pl } from "@/i18n/pl";
import { OPTIONAL_NEEDS, type NeedRule, type Thresholds } from "./profiles";
import type { AccessibilityAttribute, NeedVerdict, ResolvedAttribute, Verdict } from "./types";

const t = pl.profile.reasons;

type PlaceFacts = { attributes: ResolvedAttribute[] };

const SMOOTH_SURFACES = new Set(["asphalt", "concrete", "paving_stones", "paved", "flat"]);

type Resolved =
  | { kind: "known"; attribute: ResolvedAttribute }
  | { kind: "unresolved"; state: Extract<NeedVerdict, "unknown" | "conflict"> };

/** Unknown, stale and conflicting attributes never count as met — only known values do. */
function resolve(place: PlaceFacts, attribute: AccessibilityAttribute): Resolved {
  const found = place.attributes.find((a) => a.attribute === attribute);
  if (found?.state === "conflict") return { kind: "unresolved", state: "conflict" };
  if (!found || found.state !== "known" || found.value == null) return { kind: "unresolved", state: "unknown" };
  return { kind: "known", attribute: found };
}

const numberOf = (a: ResolvedAttribute) => (a.value?.kind === "number" ? a.value.number : null);
const booleanOf = (a: ResolvedAttribute) => (a.value?.kind === "boolean" ? a.value.boolean : null);
const textOf = (a: ResolvedAttribute) => (a.value?.kind === "text" ? a.value.text : null);
const isUnconfirmed = (a: ResolvedAttribute) => a.status !== "confirmed";

function result(need: Need, attribute: AccessibilityAttribute, state: NeedVerdict, reason: string | null, unconfirmed = false): NeedResult {
  return { need, attribute, state, reason, unconfirmed: state === "met" && unconfirmed };
}

function unresolved(need: Need, attribute: AccessibilityAttribute, state: "unknown" | "conflict"): NeedResult {
  return result(need, attribute, state, t.unresolved(need));
}

function entrance(place: PlaceFacts, th: Thresholds): NeedResult {
  // OSM's overall tag is one fact among others: "no" blocks a step-free entrance, "yes" never proves one.
  const overall = resolve(place, "wheelchair_overall");
  if (th.requireStepFree && overall.kind === "known" && textOf(overall.attribute) === "no") {
    return result("entrance", "wheelchair_overall", "barrier", t.overallNo);
  }

  const steps = resolve(place, "step_count");
  const count = steps.kind === "known" ? numberOf(steps.attribute) : null;
  if (steps.kind === "unresolved" || count === null) {
    // OSM rarely counts steps; a known ramp or level entrance answers the need on its own, as in featureState.
    const alternative = (["ramp", "entrance_level"] as const)
      .map((attribute) => resolve(place, attribute))
      .find((r) => r.kind === "known" && booleanOf(r.attribute) === true);
    if (alternative?.kind === "known") {
      return result("entrance", alternative.attribute.attribute, "met", null, isUnconfirmed(alternative.attribute));
    }
    return unresolved("entrance", "step_count", steps.kind === "unresolved" ? steps.state : "unknown");
  }

  if (count === 0 || (!th.requireStepFree && count <= 1)) {
    const threshold = resolve(place, "threshold_cm");
    if (threshold.kind === "unresolved") return unresolved("entrance", "threshold_cm", threshold.state);
    const cm = numberOf(threshold.attribute);
    if (cm === null) return unresolved("entrance", "threshold_cm", "unknown");
    const unconfirmed = isUnconfirmed(steps.attribute) || isUnconfirmed(threshold.attribute);
    return cm <= th.maxThresholdCm
      ? result("entrance", "step_count", "met", null, unconfirmed)
      : result("entrance", "threshold_cm", "barrier", t.threshold(cm));
  }

  const ramp = resolve(place, "ramp");
  if (ramp.kind === "unresolved") return unresolved("entrance", "ramp", ramp.state);
  const hasRamp = booleanOf(ramp.attribute);
  if (hasRamp === null) return unresolved("entrance", "ramp", "unknown");
  return hasRamp
    ? result("entrance", "ramp", "met", null, isUnconfirmed(ramp.attribute))
    : result("entrance", "step_count", "barrier", t.steps(count));
}

function door(place: PlaceFacts, th: Thresholds): NeedResult {
  const width = resolve(place, "door_width_cm");
  if (width.kind === "unresolved") return unresolved("door", "door_width_cm", width.state);
  const cm = numberOf(width.attribute);
  if (cm === null) return unresolved("door", "door_width_cm", "unknown");
  return cm >= th.minDoorWidthCm
    ? result("door", "door_width_cm", "met", null, isUnconfirmed(width.attribute))
    : result("door", "door_width_cm", "barrier", t.door(cm));
}

/**
 * A lift is needed only where there are floors to reach, and we have no data on floors yet, so a known
 * missing lift is "can't say" rather than a barrier — a single-storey café is never blocked by it.
 */
// TODO(KBB-47): block on lift=false once the place's number of floors is known.
function lift(place: PlaceFacts, need: Need, attribute: AccessibilityAttribute): NeedResult {
  const resolved = resolve(place, attribute);
  if (resolved.kind === "known" && booleanOf(resolved.attribute) === false) {
    return result(need, attribute, "unknown", t.liftWithoutFloors);
  }
  return facility(place, need, attribute);
}

function facility(place: PlaceFacts, need: Need, attribute: AccessibilityAttribute): NeedResult {
  const resolved = resolve(place, attribute);
  if (resolved.kind === "unresolved") return unresolved(need, attribute, resolved.state);
  const present = booleanOf(resolved.attribute);
  if (present === null) return unresolved(need, attribute, "unknown");
  return present
    ? result(need, attribute, "met", null, isUnconfirmed(resolved.attribute))
    : result(need, attribute, "barrier", t.missing(need));
}

function surface(place: PlaceFacts, need: Need, attribute: AccessibilityAttribute): NeedResult {
  const resolved = resolve(place, attribute);
  if (resolved.kind === "unresolved") return unresolved(need, attribute, resolved.state);
  const value = textOf(resolved.attribute);
  if (value === null) return unresolved(need, attribute, "unknown");
  return SMOOTH_SURFACES.has(value)
    ? result(need, attribute, "met", null, isUnconfirmed(resolved.attribute))
    : result(need, attribute, "barrier", t.surface);
}

const RULES: Record<NeedRule, (place: PlaceFacts, need: Need, attribute: AccessibilityAttribute) => NeedResult> = {
  facility,
  lift,
  surface,
};

/**
 * Checks the entrance, the door and each optional need the thresholds switch on against a place's
 * resolved attributes: barrier beats conflict beats unknown, and only all-met is met. A conflict on
 * any attribute of the place, needed or not, also rules out met; stale data never counts as met.
 */
export function matchProfile(place: PlaceFacts, thresholds: Thresholds): Verdict {
  const needs: NeedResult[] = [
    entrance(place, thresholds),
    door(place, thresholds),
    ...OPTIONAL_NEEDS.filter(({ flag }) => thresholds[flag]).map(({ rule, need, attribute }) => RULES[rule](place, need, attribute)),
  ];

  const has = (state: NeedVerdict) => needs.some((n) => n.state === state);
  const conflictElsewhere = place.attributes.some((a) => a.state === "conflict");
  const state: NeedVerdict = has("barrier")
    ? "barrier"
    : has("conflict") || conflictElsewhere
      ? "conflict"
      : has("unknown")
        ? "unknown"
        : "met";
  const reasons = needs.filter((n) => n.state !== "met" && n.reason).map((n) => n.reason as string);
  if (state === "conflict" && !has("conflict")) reasons.push(t.conflictElsewhere);
  return {
    state,
    unconfirmed: state === "met" && needs.some((n) => n.unconfirmed),
    reasons,
    blockers: needs.filter((n) => n.state === "barrier").map((n) => n.attribute),
    unknowns: needs.filter((n) => n.state === "unknown").map((n) => n.attribute),
    needs,
  };
}
