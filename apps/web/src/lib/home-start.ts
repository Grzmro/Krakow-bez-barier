import type { FeatureFilter } from "@krakow-bez-barier/contracts";
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

/** The feature filters, in the order their chips are shown. */
export const FEATURE_FILTERS: readonly FeatureFilter[] = ["step_free", "lift", "toilet_accessible", "bench", "disabled_parking", "changing_table"];

/** What the options at the bottom (and the top chips) pick: a draft until "Pokaż wyniki" commits it. */
export type HomeChoices = {
  /** `null` = all categories. */
  category: string | null;
  features: readonly FeatureFilter[];
  showUnknown: boolean;
  nearby: NearbyOrigin | null;
};

/** The query results are loaded for. */
export type HomeCommitted = HomeChoices & { q: string };

/** Picked options (`draft`) kept apart from the query the list and pins show (`committed`). */
export type HomeSelection = { committed: HomeCommitted; draft: HomeChoices };

export const NO_CHOICES: HomeChoices = { category: null, features: [], showUnknown: false, nearby: null };
export const START_SELECTION: HomeSelection = { committed: { q: "", ...NO_CHOICES }, draft: NO_CHOICES };

/** Picking an option changes the draft only: results and pins stay as they were. */
export function choose(selection: HomeSelection, change: Partial<HomeChoices>): HomeSelection {
  const draft = { ...selection.draft, ...change };
  return { ...selection, draft: draft.features.length ? draft : { ...draft, showUnknown: false } };
}

/** "Pokaż wyniki" or Enter: the draft and the typed text become the query. */
export function showResults(selection: HomeSelection, q: string): HomeSelection {
  return { ...selection, committed: { q: q.trim(), ...selection.draft } };
}

/** The search field's clear button: the typed text leaves the query; picked options and the other choices stay. */
export function clearQuery(selection: HomeSelection): HomeSelection {
  return { ...selection, committed: { ...selection.committed, q: "" } };
}

/** An explicit command (quick action, a category named in a suggestion or command): asks at once, replacing the choices. */
export function runAsk(selection: HomeSelection, ask: Partial<HomeChoices> & { q?: string }): HomeSelection {
  const { q = "", ...choices } = ask;
  const draft = { ...NO_CHOICES, nearby: selection.draft.nearby, ...choices };
  return { committed: { q, ...draft }, draft };
}

/**
 * "Szukaj w całym Krakowie" after an empty result: a typed name stays and searches the whole city, without the
 * category, filters or "W mojej okolicy" that narrowed it. `null` when the name alone was already searched city-wide
 * (nothing wider to offer). Without a name it returns to the start, as before.
 */
export function widenSearch({ committed }: HomeSelection): HomeSelection | null {
  if (!committed.q.trim()) return START_SELECTION;
  if (!isSearching({ ...committed, q: "" })) return null;
  return { committed: { q: committed.q, ...NO_CHOICES }, draft: NO_CHOICES };
}

/** A change that belongs to a command already asked (the position that arrives for it, "show places without data") applies to the query at once. */
export function commitChange(selection: HomeSelection, change: Partial<HomeChoices>): HomeSelection {
  return { committed: { ...selection.committed, ...change }, draft: { ...selection.draft, ...change } };
}

const sameNearby = (a: NearbyOrigin | null, b: NearbyOrigin | null) =>
  a === b || Boolean(a && b && a.place === b.place && a.position.latitude === b.position.latitude && a.position.longitude === b.position.longitude);

const sameChoices = (a: HomeChoices, b: HomeChoices) =>
  a.category === b.category &&
  a.showUnknown === b.showUnknown &&
  a.features.length === b.features.length &&
  a.features.every((feature) => b.features.includes(feature)) &&
  sameNearby(a.nearby, b.nearby);

/**
 * What the confirm button does for the text typed so far: nothing while the draft equals the query; "show" loads
 * the results of the draft; "clear" (everything unpicked, results still up) returns to the clean map.
 */
export function confirmAction({ committed, draft }: HomeSelection, q: string): "hidden" | "show" | "clear" {
  if (q.trim() === committed.q && sameChoices(draft, committed)) return "hidden";
  return isSearching({ q, ...draft }) ? "show" : "clear";
}

/** The chosen options and typed text as the filters a count request needs; `null` when nothing is chosen. */
export function draftAsk({ draft }: HomeSelection, q: string): (HomeChoices & { q: string }) | null {
  return isSearching({ q, ...draft }) ? { q: q.trim(), ...draft } : null;
}

/** How many of the nearest places the start peek lists. */
export const PEEK_LIMIT = 5;

export type PeekHeading = "nearYou" | "nearChosen" | "nearCentre";
const HEADINGS: Record<SearchSource, PeekHeading> = { user: "nearYou", chosen: "nearChosen", map: "nearCentre" };

/**
 * What the home screen shows: at the start a clean map (no pins) and a partly slid out panel peeking the
 * nearest places; once something was asked, the results panel and pins for those results only. The peek
 * says "near you" only for a real device position.
 */
export function homeView(ask: HomeAsk, origin: Pick<SearchOrigin, "source">) {
  const searching = isSearching(ask);
  return {
    searching,
    pins: searching,
    panel: searching ? ("results" as const) : ("peek" as const),
    heading: HEADINGS[origin.source],
  };
}

/** The sheet's own state: how far it is pulled up, whether the user hid it, and the highlighted place. */
export type PanelUi = { expanded: boolean; stowed: boolean; selectedId: string | null };

/**
 * Entering or leaving the search starts the panel over: results and the start peek each come back slid out,
 * not pulled up, with nothing selected. Without it a place picked in the results keeps the sheet tall and
 * highlighted after the search was cleared.
 */
export function panelAfterAsk(wasSearching: boolean, searching: boolean, ui: PanelUi): PanelUi {
  return wasSearching === searching ? ui : { expanded: false, stowed: false, selectedId: null };
}

/** Escape (outside a dialog or popup): first drop the selected place, then pull the sheet back down. */
export function escapeStep({ expanded, selectedId }: Pick<PanelUi, "expanded" | "selectedId">): "deselect" | "collapse" | null {
  return selectedId ? "deselect" : expanded ? "collapse" : null;
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
