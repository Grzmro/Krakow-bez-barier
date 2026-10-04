import type { Bbox } from "@/lib/map-points";

const round = (value: number) => Number(value.toFixed(4));

/** The map's view as the list's search box: rounded to ~10 m, so a settled view maps to one cacheable request. */
export function roundView([west, south, east, north]: Bbox): Bbox {
  return [round(west), round(south), round(east), round(north)];
}

/**
 * The box the list (and the map's points) cover: a fixed search area ("W mojej okolicy") when there is one, otherwise
 * the map's current view. `undefined` while the map has not reported a view (or has none): the whole city, nearest first.
 */
export function listArea(area: Bbox | undefined, view: Bbox | null): Bbox | undefined {
  return area ?? view ?? undefined;
}

/** Whether the pages fetched so far (`loaded` rows) hold fewer places than the area has (`total`). */
export function isPartial(loaded: number, total: number | undefined): boolean {
  return total !== undefined && loaded < total;
}

/** What the map's points leave out when the server cut them (`GET /places/points` → `truncated`); `null` when nothing. */
export function pointsCut(points: { items: unknown[]; total: number; truncated: boolean } | undefined): { shown: number; total: number } | null {
  return points?.truncated ? { shown: points.items.length, total: points.total } : null;
}
