import type { PlacePoint, PlaceSummary } from "@krakow-bez-barier/contracts";

/** `[west, south, east, north]`, WGS84. */
export type Bbox = [number, number, number, number];

/** Grid (degrees, ~1 km) the requested area snaps to, so small pans hit the same cached request. */
const GRID = 0.01;

const down = (value: number) => Math.floor(value / GRID) * GRID;
const up = (value: number) => Math.ceil(value / GRID) * GRID;
const fixed = (value: number) => Number(value.toFixed(2));

/** The area to load points for: the view with half a view of margin on each side, snapped outward to the grid. */
export function pointsArea([west, south, east, north]: Bbox): Bbox {
  const lon = (east - west) / 2;
  const lat = (north - south) / 2;
  return [
    fixed(Math.max(-180, down(west - lon))),
    fixed(Math.max(-90, down(south - lat))),
    fixed(Math.min(180, up(east + lon))),
    fixed(Math.min(90, up(north + lat))),
  ];
}

export const containsBbox = (outer: Bbox, inner: Bbox) =>
  inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];

/**
 * The area to load after the view moved: the loaded one as long as the view stays inside it (zooming in or a short pan
 * needs nothing new), otherwise a new `pointsArea` around the view.
 */
export function nextPointsArea(loaded: Bbox | null, view: Bbox): Bbox {
  if (loaded && containsBbox(loaded, view)) return loaded;
  const next = pointsArea(view);
  // A view wider than the world is never contained; the same area must stay the same object, or React re-renders.
  return loaded && next.every((value, i) => value === loaded[i]) ? loaded : next;
}

/** A list row as a map point, for the map before its own points arrive. */
export function toPoint({ id, name, category, location, verdict }: PlaceSummary): PlacePoint {
  return { id, name, category, location, verdict: verdict?.state ?? null };
}
