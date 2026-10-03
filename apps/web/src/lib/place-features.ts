import type { AccessibilityAttribute, FeatureFilter, SummaryChip } from "@krakow-bez-barier/contracts";
import type { Status } from "@krakow-bez-barier/ui";

/** Attributes that satisfy each home-screen feature filter (any one of them is enough). */
export const FEATURE_ATTRIBUTES: Record<FeatureFilter, AccessibilityAttribute[]> = {
  step_free: ["step_count", "ramp", "entrance_level"],
  lift: ["lift"],
  toilet_accessible: ["toilet_accessible"],
  bench: ["bench"],
  disabled_parking: ["disabled_parking"],
  changing_table: ["changing_table"],
};

export type FeatureMatch = "known" | "unknown" | "conflict";

/**
 * How a place's summary answers one feature filter. Summary chips carry no value, so a `known`
 * (or `stale`) chip counts as the feature being present — examples only list present features
 * as known. Missing chips are unknown: unknown never means accessible.
 */
export function matchFeature(summary: SummaryChip[], feature: FeatureFilter): FeatureMatch {
  const chips = summary.filter((chip) => FEATURE_ATTRIBUTES[feature].includes(chip.attribute));
  if (chips.some((chip) => chip.state === "known" || chip.state === "stale")) return "known";
  if (chips.some((chip) => chip.state === "conflict")) return "conflict";
  return "unknown";
}

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres between two `[lon, lat]` points, rounded to 10 m. */
export function distanceMeters([lon1, lat1]: number[], [lon2, lat2]: number[]): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round((2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))) / 10) * 10;
}

/**
 * Status badge for a list row when feature filters are on and "show places without data" lets in
 * places that don't meet them by known data: conflict wins over unknown. `null` = all filters known.
 */
export function filterGapStatus(summary: SummaryChip[], features: FeatureFilter[]): Extract<Status, "unknown" | "conflict"> | null {
  const matches = features.map((feature) => matchFeature(summary, feature));
  if (matches.includes("conflict")) return "conflict";
  if (matches.includes("unknown")) return "unknown";
  return null;
}

/** One line of facts for a list row, e.g. "Wejście bez stopni · Winda · Toaleta: brak danych". */
export function summaryLine(summary: SummaryChip[], fallback: (chip: SummaryChip) => string): string {
  return summary.map((chip) => chip.label || fallback(chip)).join(" · ");
}
