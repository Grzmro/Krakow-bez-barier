export type CityConfig = {
  id: string;
  name: string;
  /** UI language of the city (BCP 47). */
  language: string;
  bbox: { south: number; west: number; north: number; east: number };
  /** Default map view for the city, `[lon, lat]`. */
  defaults: { center: [number, number]; zoom: number };
  /** Source ids enabled for this city. */
  sources: string[];
  /** Category ids (from the category config) ingested for this city; all configured ones when omitted. */
  categories?: string[];
  /** Endpoints and other per-source settings; the key is the source id. */
  /** `extractUrl`: a file with the same data, read when the endpoint is unreachable (OSM: a Geofabrik `.osm.pbf`). */
  sourceConfig: Record<string, { endpoint?: string; extractUrl?: string }>;
};
