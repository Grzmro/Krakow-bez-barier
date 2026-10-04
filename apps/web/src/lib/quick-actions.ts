import type { Category, FeatureFilter, PlaceSummary } from "@krakow-bez-barier/contracts";
import { filterGapStatus } from "@/lib/place-features";

/** Why a quick action can't run yet; its copy lives in `home.quick.unavailable`. */
export type QuickActionUnavailable = never;

export interface QuickActionConfig {
  id: string;
  /** Category to list; omitted = every category. */
  category?: Category;
  /**
   * Feature filters the result must meet by known data (never by missing data). Empty = the nearest place of the
   * category, its card facts shown with "Brak danych" where nothing is known.
   */
  features: FeatureFilter[];
  /** Icon key from the category icon registry (`lib/categories.tsx`). */
  icon: string;
  /** Set while the data behind the action isn't loaded: the action is shown as unavailable, never as "nothing nearby". */
  unavailable?: QuickActionUnavailable;
}

/**
 * The quick actions on the home screen, in display order. An entry here (plus its label in
 * `i18n/{pl,en}/home.ts` → `quick.actions`, which the types require) is all a new action needs.
 */
export const QUICK_ACTIONS = [
  { id: "toilet", category: "toilet", features: ["toilet_accessible"], icon: "toilet" },
  { id: "rest", features: ["bench"], icon: "armchair" },
  { id: "lift", features: ["lift"], icon: "elevator" },
  { id: "pharmacy", category: "pharmacy", features: ["step_free"], icon: "pill" },
  // No filter: OSM says nothing about step-free boarding, so the nearest stop is shown with what is known about it.
  { id: "transit_stop", category: "transit_stop", features: [], icon: "bus" },
] as const satisfies readonly QuickActionConfig[];

export type QuickActionId = (typeof QUICK_ACTIONS)[number]["id"];
export type QuickAction = QuickActionConfig & { id: QuickActionId };

/** The filters a quick action sets on the home list. */
export function quickFilters(action: QuickAction): { category: Category | null; features: FeatureFilter[] } {
  return { category: action.category ?? null, features: [...action.features] };
}

/** Whether the list still shows what the action set: changing the category or feature filters by hand ends it. */
export function quickStillApplies(action: QuickAction, current: { category: string | null; features: readonly FeatureFilter[] }): boolean {
  const wanted = quickFilters(action);
  return (
    wanted.category === current.category &&
    wanted.features.length === current.features.length &&
    wanted.features.every((feature) => current.features.includes(feature))
  );
}

/**
 * The nearest place that meets every feature filter by known data. Places listed only because "show places
 * without data" is on are skipped: unknown is never presented as accessible. `items` are nearest first.
 */
export function nearestMatch<T extends { place: Pick<PlaceSummary, "features"> }>(
  items: readonly T[],
  features: readonly FeatureFilter[],
): T | null {
  return items.find(({ place }) => filterGapStatus(place, [...features]) === null) ?? null;
}
