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

/** A map view, tagged with the search whose results were on screen when the camera last moved. */
export type TaggedView = { view: Bbox; search: string | null };

/**
 * The view to keep after the map reported one. A camera move (`moved`) tags it with the search whose results had
 * arrived by then (`settledSearch`); a report without a move (new pins drawn) keeps the old tag.
 */
export function nextTaggedView(current: TaggedView | null, view: Bbox, moved: boolean, settledSearch: string | null): TaggedView {
  const search = moved ? settledSearch : (current?.search ?? null);
  if (current && current.search === search && current.view.every((value, i) => value === view[i])) return current;
  return { view, search };
}

/**
 * The view the list of `search` follows: only one the camera moved to after that search's results arrived (the fit to
 * them, or the user's own pan). Before that the list is the search's own area, so a new search is never limited to
 * whatever the previous one left on screen (and never empty because of it).
 */
export function followedView(tagged: TaggedView | null, search: string): Bbox | null {
  return tagged?.search === search ? tagged.view : null;
}

/** Whether the pages fetched so far (`loaded` rows) hold fewer places than the area has (`total`). */
export function isPartial(loaded: number, total: number | undefined): boolean {
  return total !== undefined && loaded < total;
}

/** What the map's points leave out when the server cut them (`GET /places/points` → `truncated`); `null` when nothing. */
export function pointsCut(points: { items: unknown[]; total: number; truncated: boolean } | undefined): { shown: number; total: number } | null {
  return points?.truncated ? { shown: points.items.length, total: points.total } : null;
}
