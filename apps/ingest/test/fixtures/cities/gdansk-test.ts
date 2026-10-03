import type { CityConfig } from "../../../src/cities/types";

export const gdanskTest: CityConfig = {
  id: "gdansk-test",
  name: "Gdańsk (test)",
  language: "pl",
  bbox: { south: 54.345, west: 18.645, north: 54.355, east: 18.665 },
  defaults: { center: [18.655, 54.35], zoom: 14 },
  sources: ["osm"],
  sourceConfig: { osm: { endpoint: "https://overpass.example/api/interpreter" } },
};
