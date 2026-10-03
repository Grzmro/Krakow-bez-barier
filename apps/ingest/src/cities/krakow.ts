import type { CityConfig } from "./types";

export const krakow: CityConfig = {
  id: "krakow",
  name: "Kraków",
  language: "pl",
  // Demo area: Stare Miasto + Kazimierz + Stradom (docs/demo-data.md)
  bbox: { south: 50.045, west: 19.925, north: 50.06, east: 19.96 },
  defaults: { center: [19.9373, 50.0614], zoom: 15 },
  sources: ["osm", "msip-toilets", "zdmk-parking-ozn", "ztp-stops"],
  sourceConfig: {
    osm: {
      endpoint: "https://overpass-api.de/api/interpreter",
      extractUrl: "https://download.geofabrik.de/europe/poland/malopolskie-latest.osm.pbf",
    },
    "msip-toilets": {
      endpoint: "https://msip.um.krakow.pl/arcgis/rest/services/Obserwatorium/WT_WC_2023/MapServer/0",
    },
    "zdmk-parking-ozn": {
      endpoint:
        "https://services-eu1.arcgis.com/svTzSt3AvH7sK6q9/arcgis/rest/services/Miejsca_postojowe_OZN/FeatureServer/0",
    },
    "ztp-stops": {
      endpoint:
        "https://services-eu1.arcgis.com/svTzSt3AvH7sK6q9/arcgis/rest/services/Przystanki_Komunikacji_Miejskiej_w_Krakowie/FeatureServer/0",
    },
  },
};
