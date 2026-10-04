import type { Need, PlaceSummary } from "@krakow-bez-barier/contracts";
import { STATUSES, type Status } from "@krakow-bez-barier/ui";

/** Display order of verdicts: what works first, what blocks last. */
export const STATUS_ORDER: Status[] = ["met", "conflict", "unknown", "barrier"];

export function countByStatus(items: { place: PlaceSummary }[]): Record<Status, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const { place } of items) if (place.verdict) counts[place.verdict.state] += 1;
  return counts;
}

/** How many places could not check each need for lack of data, most often missing first; needs nobody lacks are left out. */
export function missingNeeds(items: { place: PlaceSummary }[]): { need: Need; count: number }[] {
  const counts = new Map<Need, number>();
  for (const { place } of items) {
    for (const need of place.verdict?.needs ?? []) {
      if (need.state === "unknown") counts.set(need.need, (counts.get(need.need) ?? 0) + 1);
    }
  }
  return [...counts].map(([need, count]) => ({ need, count })).toSorted((a, b) => b.count - a.count);
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
    .filter((item) => passesVerdict(stateOf(item), filter))
    .toSorted((a, b) => STATUS_ORDER.indexOf(stateOf(a)) - STATUS_ORDER.indexOf(stateOf(b)));
}

function passesVerdict(state: Status, filter: VerdictFilter): boolean {
  if (filter.status && state !== filter.status) return false;
  return !(filter.hideFailing && state === "barrier");
}

/** Map points through the same status filters as the list; points without verdicts (no profile) pass untouched. */
export function filterPointsByVerdict<T extends { verdict: Status | null }>(points: T[], filter: VerdictFilter): T[] {
  if (!points.some((point) => point.verdict)) return points;
  return points.filter((point) => passesVerdict(point.verdict ?? "unknown", filter));
}
