import type { CityConfig } from "../../../src/cities/types";

export const broken: CityConfig = {
  id: "broken-test",
  name: "Broken (test)",
  language: "pl",
  bbox: { south: 1, west: 1, north: 2, east: 2 },
  defaults: { center: [1, 1], zoom: 10 },
  sources: ["osm"],
  sourceConfig: {},
  categories: ["museum", "nope"],
};
