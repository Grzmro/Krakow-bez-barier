import type { CityConfig } from "./types";

export const krakow: CityConfig = {
  id: "krakow",
  name: "Kraków",
  language: "pl",
  // Demo area: Stare Miasto + Kazimierz + Stradom (docs/demo-data.md)
  bbox: { south: 50.045, west: 19.925, north: 50.06, east: 19.96 },
  defaults: { center: [19.9373, 50.0614], zoom: 15 },
  sources: ["osm"],
  sourceConfig: {
    osm: { endpoint: "https://overpass-api.de/api/interpreter" },
  },
};
