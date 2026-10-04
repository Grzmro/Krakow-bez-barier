import { krakowBipMalopolskaPages } from "./data/krakow-bip-malopolska";
import { krakowBipPages } from "./data/krakow-bip-pages";
import { krakowPlToiletsPage } from "./data/krakow-pl-toilets";
import type { CityConfig } from "./types";

export const krakow: CityConfig = {
  id: "krakow",
  name: "Kraków",
  language: "pl",
  // The whole city: the bounding box of Kraków's administrative boundary, rounded outwards.
  bbox: { south: 49.967, west: 19.792, north: 50.126, east: 20.217 },
  areas: {
    // Stare Miasto + Kazimierz + Stradom (docs/demo-data.md)
    demo: { south: 50.045, west: 19.925, north: 50.06, east: 19.96 },
  },
  defaults: { center: [19.9373, 50.0614], zoom: 15 },
  sources: ["osm", "msip-toilets", "zdmk-parking-ozn", "ztp-stops", "bip-mk", "krakow-pl-toilets", "bip-malopolska", "rejestr-aptek"],
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
    "bip-mk": { pages: krakowBipPages },
    "krakow-pl-toilets": { pages: [krakowPlToiletsPage] },
    "bip-malopolska": { endpoint: "https://bip.malopolska.pl/api/", pages: krakowBipMalopolskaPages },
    // Pharmacies are placed on OSM pharmacies or address points read from the `osm` endpoint above.
    "rejestr-aptek": { endpoint: "https://rejestry.ezdrowie.gov.pl/api/ra/filegenerator/getcsv" },
  },
};
