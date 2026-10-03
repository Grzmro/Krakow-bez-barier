import type { CityConfig } from "./types";

// Proof that a city is configuration only (OSM data, no adapter code). Not part of the demo
// data and not in the scheduled ingest; run it by hand: `npm run ingest -- --city wroclaw`.
export const wroclaw: CityConfig = {
  id: "wroclaw",
  name: "Wrocław",
  language: "pl",
  bbox: { south: 51.105, west: 17.025, north: 51.115, east: 17.045 },
  defaults: { center: [17.0325, 51.11], zoom: 15 },
  sources: ["osm"],
  categories: ["restaurant", "museum", "toilet", "hotel", "pharmacy"],
  sourceConfig: {
    osm: {
      endpoint: "https://overpass-api.de/api/interpreter",
      extractUrl: "https://download.geofabrik.de/europe/poland/dolnoslaskie-latest.osm.pbf",
    },
  },
};
