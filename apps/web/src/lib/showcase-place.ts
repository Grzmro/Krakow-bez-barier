"use client";

import type { Category, PlaceSummary } from "@krakow-bez-barier/contracts";
import { config } from "./config";
import { usePlaces } from "./places";

/** The API's page limit: the most candidates one request can return. */
export const SHOWCASE_CANDIDATES = 100;

const documented = (place: Pick<PlaceSummary, "summary">) => place.summary.filter((chip) => chip.state !== "unknown").length;

/**
 * The place that shows the most: real data before sample data, then the most attributes with data.
 * Ties keep the list order (nearest first when the list was asked with `near`). `undefined` for an empty list.
 */
export function bestDocumented<T extends Pick<PlaceSummary, "summary" | "isSample">>(places: readonly T[]): T | undefined {
  let best: T | undefined;
  for (const place of places) {
    if (
      !best ||
      (best.isSample && !place.isSample) ||
      (best.isSample === place.isSample && documented(place) > documented(best))
    )
      best = place;
  }
  return best;
}

/**
 * A real place to show the widget and the API on: the best-documented place of `category` near the Rynek,
 * picked from whatever the data API serves, so the example never points at a place that isn't there.
 */
export function useShowcasePlace(category: Category) {
  const places = usePlaces({ category: [category], near: config.cityCenter, limit: SHOWCASE_CANDIDATES });
  return { ...places, place: places.data ? bestDocumented(places.data.items) : undefined };
}
