import { type Bbox, containsBbox } from "@/lib/map-points";
import type { NearbyOrigin } from "@/lib/nearby";
import { searchArea, searchCentre } from "@/lib/nearby";
import { roundView } from "@/lib/view-list";

/**
 * How far "W mojej okolicy" looks: the start area (about 2 km), a wider ring (about 5 km), the whole city, or
 * the map's view the user asked to search ("Szukaj w tym obszarze"). Only a coarse area ever goes to the API.
 */
export type SearchScope = { kind: "near" } | { kind: "wide" } | { kind: "city" } | { kind: "view"; view: Bbox };

export const NEAR_SCOPE: SearchScope = { kind: "near" };

/** Half-size of the wider area around the snapped centre: about 5.5 km in both directions in Kraków. */
const WIDE_HALF_LAT_DEG = 0.05;
const WIDE_HALF_LON_DEG = 0.08;

/** Everything listed for Kraków; the list's "whole city" step. */
export const CITY_AREA: Bbox = [19.7, 49.9, 20.25, 50.25];

/** Fewer results than this count as "poor": the widening offer shows next to them. */
export const POOR_RESULTS = 5;

const fixed = (value: number) => Number(value.toFixed(2));

/** The box a scope asks the API for around `nearby`; the exact position never leaves the device. */
export function scopeArea(nearby: NearbyOrigin, scope: SearchScope): Bbox {
  switch (scope.kind) {
    case "near":
      return searchArea(nearby.position);
    case "wide": {
      const [lon, lat] = searchCentre(nearby.position);
      return [fixed(lon - WIDE_HALF_LON_DEG), fixed(lat - WIDE_HALF_LAT_DEG), fixed(lon + WIDE_HALF_LON_DEG), fixed(lat + WIDE_HALF_LAT_DEG)];
    }
    case "city":
      return CITY_AREA;
    case "view":
      return scope.view;
  }
}

/** The scope "Szukaj w tym obszarze" switches to: the map's view, rounded to ~10 m like the list's own view. */
export function viewScope(view: Bbox): SearchScope {
  return { kind: "view", view: roundView(view) };
}

/** How far (share of the area's size) the view may stick out before it counts as left: a phone's tall view overhangs a bit at once. */
const OVERHANG = 0.1;

/** Whether the map's view reaches clearly outside the searched area, so the "Szukaj w tym obszarze" button is due. */
export function viewLeavesArea(area: Bbox | undefined, view: Bbox | null): boolean {
  if (!area || !view) return false;
  const lon = (area[2] - area[0]) * OVERHANG;
  const lat = (area[3] - area[1]) * OVERHANG;
  return !containsBbox([area[0] - lon, area[1] - lat, area[2] + lon, area[3] + lat], view);
}

/** The next wider scope the empty or poor result offers (2 km → 5 km → whole city); `null` when there is none. */
export function widerScope(scope: SearchScope): SearchScope | null {
  if (scope.kind === "near") return { kind: "wide" };
  if (scope.kind === "wide") return { kind: "city" };
  return null;
}

/** Whether the scope equals another one (a view compares by its box). */
export function sameScope(a: SearchScope, b: SearchScope): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== "view" || (b.kind === "view" && a.view.every((value, i) => value === b.view[i]));
}
