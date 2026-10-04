import type { Category, FeatureFilter, PlaceSummary } from "@krakow-bez-barier/contracts";
import type { Locale } from "@/i18n/locale";
import type { Messages } from "@/i18n/messages";
import type { DistanceFrom } from "@/lib/nearby";
import { formatDate } from "@/lib/place-facts";
import { filterGapStatus } from "@/lib/place-features";

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

/**
 * The nearest place that has every feature by known data, where at least one is known only from outdated data
 * (`stale`), with the oldest such date. It is never a pass: the UI shows it as "may be outdated" with that date,
 * so outdated data isn't hidden as if nothing were there. `items` are nearest first.
 */
export function nearestStaleMatch<T extends { place: Pick<PlaceSummary, "features"> }>(
  items: readonly T[],
  features: readonly FeatureFilter[],
): { item: T; asOf: string | null } | null {
  if (!features.length) return null;
  for (const item of items) {
    const matches = features.map((feature) => item.place.features?.find((match) => match.feature === feature));
    if (!matches.every((match) => match?.state === "met" || match?.state === "stale")) continue;
    const stale = matches.filter((match) => match?.state === "stale");
    if (!stale.length) continue;
    const dates = stale.map((match) => match?.asOf).filter((date): date is string => Boolean(date));
    return { item, asOf: dates.toSorted()[0] ?? null };
  }
  return null;
}

export type QuickResultState =
  | { kind: "needLocation" }
  | { kind: "searching" }
  | { kind: "none" }
  | {
      kind: "found";
      place: PlaceSummary;
      distance: number;
      from: DistanceFrom;
      /** Found only by outdated data: shown as "may be outdated" with the date it was last true, never as a pass. */
      stale?: { asOf: string | null };
    };

/** "Może być nieaktualne · 15.09.2025", or without a date when none is known. */
export const staleLabel = (m: Messages, locale: Locale, asOf: string | null) =>
  asOf ? m.common.fact.maybeOutdated(formatDate(asOf, locale)) : m.home.quick.maybeOutdated;

/** The live-region sentence for a quick action's result; `null` while it has nothing to say. */
export function quickAnnouncement(m: Messages, locale: Locale, quick: QuickAction | null, state: QuickResultState | null): string | null {
  if (!quick || !state) return null;
  const t = m.home.quick;
  const result = t.actions[quick.id].result;
  if (state.kind === "none") return t.none(result);
  if (state.kind !== "found") return null;
  const distance = m.home.list.distance(state.distance, state.from);
  if (!state.stale) return t.found(result, state.place.name, distance);
  return t.foundStale(result, state.place.name, distance, staleLabel(m, locale, state.stale.asOf));
}
