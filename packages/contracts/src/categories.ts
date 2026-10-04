import type { components } from "./generated/schema";

export type CategoryDefinition = components["schemas"]["CategoryDefinition"];
type FeatureFilter = components["schemas"]["FeatureFilter"];
type AccessibilityAttribute = components["schemas"]["AccessibilityAttribute"];

export type OsmTagRule = {
  key: string;
  values: string[];
  /** Another tag the element must also have, whatever its value (`capacity:disabled` on a car park). */
  requires?: string;
  /** Name of an unnamed element matched by this rule; overrides the category's `unnamedName`. */
  unnamedName?: string;
  /** An unnamed element takes the name of a relation with this tag it belongs to (a platform named by its `stop_area`). */
  nameFromRelation?: { key: string; value: string };
};

export type CategoryConfig = CategoryDefinition & {
  /** OSM tags that put an element in this category. The first category with a matching rule wins. */
  osm: OsmTagRule[];
  /** Name given to unnamed places of this category; without it an unnamed place is skipped. */
  unnamedName?: string;
  /** Left out of `GET /places` unless the request names the category (bulk city data such as parking spaces). */
  hiddenByDefault?: boolean;
  /** A hidden category `GET /places` lists after all when the request filters by this feature (benches for „Ławki”). */
  feature?: FeatureFilter;
  /**
   * Bits of the way, not destinations (steps, kerbs): left out of `GET /categories` and, like `hiddenByDefault`, of
   * `GET /places`; their facts describe the route segments passing them.
   */
  onRoutes?: boolean;
  /** An element whose tags give no fact is skipped: a kerb of unknown height says nothing. */
  skipWithoutFacts?: boolean;
  /**
   * Elements of this category closer than this many metres that share a name (or where one is unnamed) are one place,
   * the one with the most tags kept: a stop mapped as a `bus_stop` node and as the platform's outline.
   */
  mergeWithinM?: number;
  /**
   * What the place card lists for this category, in reading order, instead of the venue set (entrance, toilet, …);
   * list rows then name missing data only for these. A stop has a platform, not an entrance.
   */
  cardAttributes?: AccessibilityAttribute[];
  /**
   * Places of this category have no door of their own (a statue, a plaque on a façade), so OSM `entrance=*` nodes are
   * never attached to them. Hidden and on-route categories never take entrances either.
   */
  withoutEntrances?: boolean;
};

/**
 * The one place categories are defined. An entry here is all it takes for a category to be
 * ingested from OpenStreetMap, listed by `GET /categories` and shown in the web UI.
 * `icon` must be a key the web icon registry knows, otherwise the UI falls back to a pin.
 */
export const categories: readonly CategoryConfig[] = [
  { id: "restaurant", label: "Restauracje", singularLabel: "Restauracja", icon: "fork-knife", osm: [{ key: "amenity", values: ["restaurant", "cafe", "fast_food", "bar", "pub"] }] },
  { id: "museum", label: "Muzea", singularLabel: "Muzeum", icon: "bank", osm: [{ key: "tourism", values: ["museum"] }] },
  { id: "toilet", label: "Toalety", singularLabel: "Toaleta", icon: "toilet", osm: [{ key: "amenity", values: ["toilets"] }], unnamedName: "Toaleta publiczna" },
  { id: "hotel", label: "Hotele", singularLabel: "Hotel", icon: "bed", osm: [{ key: "tourism", values: ["hotel", "hostel", "guest_house"] }] },
  { id: "monument", label: "Zabytki", singularLabel: "Zabytek", icon: "church", osm: [{ key: "historic", values: ["monument", "memorial"] }], withoutEntrances: true },
  { id: "theatre", label: "Teatry i kina", singularLabel: "Teatr lub kino", icon: "mask-happy", osm: [{ key: "amenity", values: ["theatre", "cinema"] }] },
  { id: "pharmacy", label: "Apteki", singularLabel: "Apteka", icon: "pill", osm: [{ key: "amenity", values: ["pharmacy"] }, { key: "healthcare", values: ["pharmacy"] }] },
  {
    id: "parking",
    label: "Miejsca postojowe",
    singularLabel: "Miejsce postojowe",
    icon: "car",
    osm: [
      { key: "parking_space", values: ["disabled"], unnamedName: "Miejsce postojowe dla osób z niepełnosprawnościami" },
      { key: "amenity", values: ["parking"], requires: "capacity:disabled" },
    ],
    unnamedName: "Parking",
    hiddenByDefault: true,
    feature: "disabled_parking",
  },
  { id: "bench", label: "Ławki", singularLabel: "Ławka", icon: "armchair", osm: [{ key: "amenity", values: ["bench"] }], unnamedName: "Ławka", hiddenByDefault: true, feature: "bench" },
  { id: "elevator", label: "Windy", singularLabel: "Winda", icon: "elevator", osm: [{ key: "highway", values: ["elevator"] }], unnamedName: "Winda", hiddenByDefault: true, feature: "lift" },
  {
    id: "transit_stop",
    label: "Przystanki",
    singularLabel: "Przystanek",
    icon: "bus",
    // The platform carries the facts (tactile paving, shelter, bench); `stop_position` and `tram_stop` sit on the road or track.
    osm: [{ key: "public_transport", values: ["platform"], nameFromRelation: { key: "public_transport", value: "stop_area" } }],
    unnamedName: "Przystanek",
    hiddenByDefault: true,
    mergeWithinM: 30,
    cardAttributes: ["wheelchair_overall", "tactile_paving", "kerb_height_cm", "surface", "bench", "shelter"],
  },
  { id: "shop", label: "Handel", singularLabel: "Handel", icon: "shopping-bag", osm: [{ key: "shop", values: ["supermarket", "mall", "convenience", "department_store", "clothes", "shoes", "bakery", "kiosk", "books", "electronics", "variety_store", "greengrocer", "butcher", "chemist", "florist", "gift", "jewelry", "optician", "sports", "toys", "hardware", "stationery"] }] },
  { id: "other", label: "Inne", singularLabel: "Inne", icon: "map-pin", osm: [{ key: "tourism", values: ["gallery", "attraction"] }] },
  { id: "steps", label: "Schody", singularLabel: "Schody", icon: "stairs", osm: [{ key: "highway", values: ["steps"] }], unnamedName: "Schody", onRoutes: true },
  {
    id: "kerb",
    label: "Krawężniki",
    singularLabel: "Krawężnik",
    icon: "map-pin",
    osm: [
      { key: "barrier", values: ["kerb"] },
      { key: "kerb", values: ["flush", "lowered", "raised", "rolled", "yes", "no"] },
    ],
    unnamedName: "Krawężnik",
    onRoutes: true,
    skipWithoutFacts: true,
  },
];

/** What `GET /categories` lists: every category but the bits of the way. */
export const listedCategories: readonly CategoryConfig[] = categories.filter((c) => !c.onRoutes);

/** Ids of the categories whose facts describe the routes passing them. */
export const routeCategoryIds = (list: readonly CategoryConfig[] = categories): string[] =>
  list.filter((c) => c.onRoutes).map((c) => c.id);

/** Ids `GET /places` leaves out unless the request names them: hidden ones, but not those the request's feature filters ask for. */
export function hiddenCategoryIds(features: readonly FeatureFilter[] = [], list: readonly CategoryConfig[] = categories): string[] {
  return list
    .filter((c) => (c.hiddenByDefault || c.onRoutes) && !(c.feature && features.includes(c.feature)))
    .map((c) => c.id);
}

/** The public shape of a category (no ingestion details), what `GET /categories` returns. */
export function toCategoryDefinition({ id, label, singularLabel, icon }: CategoryConfig): CategoryDefinition {
  return { id, label, singularLabel, icon };
}

export const isKnownCategory = (id: string, list: readonly CategoryConfig[] = categories) =>
  list.some((c) => c.id === id);
