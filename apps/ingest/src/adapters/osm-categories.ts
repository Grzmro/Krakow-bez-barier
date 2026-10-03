import type { Category } from "@krakow-bez-barier/contracts";

export type OsmCategoryRule = { key: string; values: string[]; category: Category };

export const OSM_CATEGORIES: OsmCategoryRule[] = [
  { key: "tourism", values: ["museum"], category: "museum" },
  { key: "tourism", values: ["hotel", "hostel", "guest_house"], category: "hotel" },
  { key: "tourism", values: ["gallery", "attraction"], category: "other" },
  { key: "amenity", values: ["restaurant", "cafe", "fast_food", "bar", "pub"], category: "restaurant" },
  { key: "amenity", values: ["toilets"], category: "toilet" },
  { key: "amenity", values: ["theatre", "cinema"], category: "theatre" },
  { key: "historic", values: ["monument", "memorial"], category: "monument" },
];
