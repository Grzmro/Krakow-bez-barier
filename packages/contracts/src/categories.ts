import type { components } from "./generated/schema";

export type CategoryDefinition = components["schemas"]["CategoryDefinition"];

export type OsmTagRule = { key: string; values: string[] };

export type CategoryConfig = CategoryDefinition & {
  /** OSM tags that put an element in this category. The first category with a matching rule wins. */
  osm: OsmTagRule[];
  /** Name given to unnamed places of this category; without it an unnamed place is skipped. */
  unnamedName?: string;
  /** Left out of `GET /places` unless the request names the category (bulk city data such as parking spaces). */
  hiddenByDefault?: boolean;
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
  { id: "monument", label: "Zabytki", singularLabel: "Zabytek", icon: "church", osm: [{ key: "historic", values: ["monument", "memorial"] }] },
  { id: "theatre", label: "Teatry i kina", singularLabel: "Teatr lub kino", icon: "mask-happy", osm: [{ key: "amenity", values: ["theatre", "cinema"] }] },
  { id: "pharmacy", label: "Apteki", singularLabel: "Apteka", icon: "pill", osm: [{ key: "amenity", values: ["pharmacy"] }] },
  { id: "parking", label: "Miejsca postojowe", singularLabel: "Miejsce postojowe", icon: "car", osm: [], hiddenByDefault: true },
  { id: "transit_stop", label: "Przystanki", singularLabel: "Przystanek", icon: "bus", osm: [], hiddenByDefault: true },
  { id: "shop", label: "Handel", singularLabel: "Handel", icon: "shopping-bag", osm: [] },
  { id: "other", label: "Inne", singularLabel: "Inne", icon: "map-pin", osm: [{ key: "tourism", values: ["gallery", "attraction"] }] },
];

/** The public shape of a category (no ingestion details), what `GET /categories` returns. */
export function toCategoryDefinition({ id, label, singularLabel, icon }: CategoryConfig): CategoryDefinition {
  return { id, label, singularLabel, icon };
}

export const isKnownCategory = (id: string, list: readonly CategoryConfig[] = categories) =>
  list.some((c) => c.id === id);
