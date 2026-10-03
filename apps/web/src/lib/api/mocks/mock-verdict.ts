import type {
  AccessibilityAttribute,
  Need,
  NeedResult,
  NeedVerdict,
  Place,
  ResolvedAttribute,
  Verdict,
} from "@krakow-bez-barier/contracts";
import { pl } from "@/i18n/pl";
import type { Thresholds } from "@/lib/profile/thresholds";

// TODO(KBB-28): stand-in for the API's matcher (KBB-17) so the UI can be built on spec examples.
// Delete with the mock layer once `GET /places` returns verdicts for the requested thresholds.

const t = pl.profile.reasons;

type PlaceFacts = Pick<Place, "attributes">;

const SMOOTH_SURFACES = new Set(["asphalt", "concrete", "paving_stones", "paved", "flat"]);

type Resolved =
  | { kind: "known"; attribute: ResolvedAttribute }
  | { kind: "unresolved"; state: Extract<NeedVerdict, "unknown" | "conflict"> };

/** Unknown, stale and conflicting attributes never count as met — only known values do. */
function resolve(place: PlaceFacts, attribute: AccessibilityAttribute): Resolved {
  const found = place.attributes.find((a) => a.attribute === attribute);
  if (!found || found.value == null) return { kind: "unresolved", state: found?.state === "conflict" ? "conflict" : "unknown" };
  if (found.state === "conflict") return { kind: "unresolved", state: "conflict" };
  if (found.state !== "known") return { kind: "unresolved", state: "unknown" };
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
  const steps = resolve(place, "step_count");
  if (steps.kind === "unresolved") return unresolved("entrance", "step_count", steps.state);
  const count = numberOf(steps.attribute);
  if (count === null) return unresolved("entrance", "step_count", "unknown");

  if (count === 0) {
    const threshold = resolve(place, "threshold_cm");
    if (threshold.kind === "unresolved") return unresolved("entrance", "threshold_cm", threshold.state);
    const cm = numberOf(threshold.attribute);
    if (cm === null) return unresolved("entrance", "threshold_cm", "unknown");
    const unconfirmed = isUnconfirmed(steps.attribute) || isUnconfirmed(threshold.attribute);
    return cm <= th.maxThresholdCm
      ? result("entrance", "step_count", "met", null, unconfirmed)
      : result("entrance", "threshold_cm", "barrier", t.threshold(cm));
  }

  if (!th.requireStepFree && count <= 1) return result("entrance", "step_count", "met", null, isUnconfirmed(steps.attribute));
  const ramp = resolve(place, "ramp");
  if (ramp.kind === "known" && booleanOf(ramp.attribute) === true) {
    return result("entrance", "ramp", "met", null, isUnconfirmed(ramp.attribute));
  }
  if (ramp.kind === "known" || th.requireStepFree) return result("entrance", "step_count", "barrier", t.steps(count));
  return unresolved("entrance", "ramp", ramp.state);
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

function facility(place: PlaceFacts, need: Need, attribute: AccessibilityAttribute): NeedResult {
  const resolved = resolve(place, attribute);
  if (resolved.kind === "unresolved") return unresolved(need, attribute, resolved.state);
  const present = booleanOf(resolved.attribute);
  if (present === null) return unresolved(need, attribute, "unknown");
  return present
    ? result(need, attribute, "met", null, isUnconfirmed(resolved.attribute))
    : result(need, attribute, "barrier", t.missing(need));
}

function surface(place: PlaceFacts): NeedResult {
  const resolved = resolve(place, "surface");
  if (resolved.kind === "unresolved") return unresolved("surface", "surface", resolved.state);
  const value = textOf(resolved.attribute);
  if (value === null) return unresolved("surface", "surface", "unknown");
  return SMOOTH_SURFACES.has(value)
    ? result("surface", "surface", "met", null, isUnconfirmed(resolved.attribute))
    : result("surface", "surface", "barrier", t.surface);
}

/** Checks each need of the profile; barrier beats conflict beats unknown, and only all-met is met. */
export function mockVerdict(place: PlaceFacts, th: Thresholds): Verdict {
  const needs: NeedResult[] = [entrance(place, th), door(place, th)];
  if (th.requireLift) needs.push(facility(place, "lift", "lift"));
  if (th.requireAccessibleToilet) needs.push(facility(place, "toilet", "toilet_accessible"));
  if (th.requireSmoothSurface) needs.push(surface(place));
  if (th.requireChangingTable) needs.push(facility(place, "changing_table", "changing_table"));

  const has = (state: NeedVerdict) => needs.some((n) => n.state === state);
  const state: NeedVerdict = has("barrier") ? "barrier" : has("conflict") ? "conflict" : has("unknown") ? "unknown" : "met";
  return {
    state,
    unconfirmed: state === "met" && needs.some((n) => n.unconfirmed),
    reasons: needs.filter((n) => n.state !== "met" && n.reason).map((n) => n.reason as string),
    blockers: needs.filter((n) => n.state === "barrier").map((n) => n.attribute),
    unknowns: needs.filter((n) => n.state === "unknown").map((n) => n.attribute),
    needs,
  };
}
