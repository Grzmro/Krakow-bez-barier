import type { PlaceSummary } from "@krakow-bez-barier/contracts";
import { STATUSES, type Status } from "@krakow-bez-barier/ui";

/** Display order of verdicts: what works first, what blocks last. */
export const STATUS_ORDER: Status[] = ["met", "conflict", "unknown", "barrier"];

export function countByStatus(items: { place: PlaceSummary }[]): Record<Status, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const { place } of items) if (place.verdict) counts[place.verdict.state] += 1;
  return counts;
}

export interface VerdictFilter {
  /** Show only places with this verdict (a pressed counter). */
  status: Status | null;
  hideFailing: boolean;
}

/**
 * Applies the status filters and puts verdicts in `STATUS_ORDER`, keeping the incoming order
 * (distance) within each status. Lists without verdicts pass through untouched.
 */
export function filterByVerdict<T extends { place: PlaceSummary }>(items: T[], filter: VerdictFilter): T[] {
  if (!items.some(({ place }) => place.verdict)) return items;
  const stateOf = (item: T) => item.place.verdict?.state ?? "unknown";
  return items
    .filter((item) => {
      const state = stateOf(item);
      if (filter.status && state !== filter.status) return false;
      return !(filter.hideFailing && state === "barrier");
    })
    .toSorted((a, b) => STATUS_ORDER.indexOf(stateOf(a)) - STATUS_ORDER.indexOf(stateOf(b)));
}
