import type { FeatureFilter, FeatureMatch, PlaceSummary, SummaryChip } from "@krakow-bez-barier/contracts";
import type { Status } from "@krakow-bez-barier/ui";

/**
 * How a list row answers one feature filter, as the API decided it from resolved values (`features`).
 * A filter the API didn't answer is unknown: unknown never means accessible.
 */
export function matchFeature(place: Pick<PlaceSummary, "features">, feature: FeatureFilter): FeatureMatch["state"] {
  return place.features?.find((match) => match.feature === feature)?.state ?? "unknown";
}

/** "Street 12, City" from whatever parts the address has; empty when there's none. */
export function formatAddress(address: PlaceSummary["address"]): string {
  if (!address) return "";
  return [[address.street, address.houseNumber].filter(Boolean).join(" "), address.city].filter(Boolean).join(", ");
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
 * places that don't meet them by known data: conflict wins over unknown. `null` = every filter met.
 */
export function filterGapStatus(
  place: Pick<PlaceSummary, "features">,
  features: readonly FeatureFilter[],
): Extract<Status, "unknown" | "conflict"> | null {
  const states = features.map((feature) => matchFeature(place, feature));
  if (states.includes("conflict")) return "conflict";
  if (states.some((state) => state !== "met")) return "unknown";
  return null;
}

/** One line of facts for a list row, e.g. "Wejście bez stopni · Winda · Toaleta: brak danych". */
export function summaryLine(summary: SummaryChip[], fallback: (chip: SummaryChip) => string): string {
  return summary.map((chip) => chip.label || fallback(chip)).join(" · ");
}
