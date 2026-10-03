import type { NearbyOrigin } from "@/lib/nearby";
import { searchArea, searchCentre, toLonLat } from "@/lib/nearby";

/** What the home screen has been asked for; every field is "nothing" at the start. */
export type HomeAsk = {
  q: string;
  /** `null` = all categories. */
  category: string | null;
  features: readonly string[];
  nearby: NearbyOrigin | null;
};

/**
 * Start state vs results: the home screen opens as a clean map with a stowed panel and shows places (list
 * and pins) only once the user searched, picked a category or a feature, or asked for "W mojej okolicy".
 * Clearing all of it returns to the start state.
 */
export function isSearching({ q, category, features, nearby }: HomeAsk): boolean {
  return Boolean(q.trim() || category || features.length || nearby);
}

/** Where a search is centred: the device, a point the user chose, or the map's centre (never called "near you"). */
export type SearchSource = "user" | "chosen" | "map";

export type SearchOrigin = {
  source: SearchSource;
  /** `[lon, lat]` the API orders the list from (snapped to a coarse grid for a position). */
  centre: [number, number];
  /** Coarse `minLon,minLat,maxLon,maxLat` box around a position; absent when searching the whole map. */
  area?: [number, number, number, number];
  /** Exact `[lon, lat]` distances are measured from on the device; absent for the map centre. */
  from: [number, number] | null;
};

/** Device position first, then the user's chosen point, then the map centre. */
export function searchOrigin(nearby: NearbyOrigin | null, mapCentre: [number, number]): SearchOrigin {
  if (!nearby) return { source: "map", centre: mapCentre, from: null };
  return {
    source: nearby.place ? "chosen" : "user",
    centre: searchCentre(nearby.position),
    area: searchArea(nearby.position),
    from: toLonLat(nearby.position),
  };
}
