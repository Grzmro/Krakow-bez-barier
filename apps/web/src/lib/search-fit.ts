import { distanceMeters } from "./place-features";

/** At most this many of the best matches decide where the map goes after a text search. */
export const FIT_TOP = 5;
/** A match farther than this from the best one doesn't pull the map out (a namesake across town). */
export const FIT_RADIUS_M = 1500;

/**
 * The places a text search fits the map to: the best match and, of the next few in ranked order, those near it, so one
 * far-off namesake ("Bistro Wawelska" in Prądnik for "Wawel") doesn't zoom the map out to the whole city.
 */
export function searchFitTargets<T extends { location: { coordinates: number[] } }>(ranked: readonly T[]): T[] {
  const [best, ...rest] = ranked.slice(0, FIT_TOP);
  if (!best) return [];
  return [best, ...rest.filter((place) => distanceMeters(best.location.coordinates, place.location.coordinates) <= FIT_RADIUS_M)];
}
