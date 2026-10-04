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
