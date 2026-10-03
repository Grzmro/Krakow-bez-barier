import type { FeatureFilter } from "@krakow-bez-barier/contracts";
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

/** `met`: known to be there; `absent`: known not to be; `unknown`/`conflict`: we can't say. */
export type FeatureState = "met" | "absent" | "unknown" | "conflict";

type Answer = "yes" | "no" | "unknown" | "conflict";

function answer(attribute: AccessibilityAttribute, resolved: ResolvedAttribute | undefined): Answer {
  if (resolved?.state === "conflict") return "conflict";
  // Stale values are shown as outdated but never let a place through a filter.
  if (!resolved || resolved.state !== "known" || !resolved.value) return "unknown";
  const { value } = resolved;
  if (attribute === "step_count") return value.kind === "number" ? (value.number === 0 ? "yes" : "no") : "unknown";
  if (value.kind !== "boolean") return "unknown";
  if (attribute === "entrance_level") return value.boolean ? "yes" : "unknown";
  return value.boolean ? "yes" : "no";
}

/**
 * How a place answers one feature filter from its resolved values. One alternative that is known to be
 * there is enough; the feature is absent only when every alternative is known not to be there.
 */
export function featureState(attributes: ResolvedAttribute[], feature: FeatureFilter): FeatureState {
  const byAttribute = new Map(attributes.map((a) => [a.attribute, a]));
  const answers = FEATURE_ATTRIBUTES[feature]
    .map((attribute) => answer(attribute, byAttribute.get(attribute)))
    .filter((a, i) => !(FEATURE_ATTRIBUTES[feature][i] === "entrance_level" && a === "unknown"));
  if (answers.includes("yes")) return "met";
  if (answers.includes("conflict")) return "conflict";
  if (answers.length > 0 && answers.every((a) => a === "no")) return "absent";
  return "unknown";
}
