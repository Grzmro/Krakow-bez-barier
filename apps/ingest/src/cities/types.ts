export type Bbox = { south: number; west: number; north: number; east: number };

export type CityConfig = {
  id: string;
  name: string;
  /** UI language of the city (BCP 47). */
  language: string;
  /** The area ingested by default, WGS84. */
  bbox: Bbox;
  /** Smaller named areas a run can be limited to with `--area <name>` or `INGEST_AREA`, e.g. a demo district. */
  areas?: Record<string, Bbox>;
  /** Default map view for the city, `[lon, lat]`. */
  defaults: { center: [number, number]; zoom: number };
  /** Source ids enabled for this city. */
  sources: string[];
  /** Category ids (from the category config) ingested for this city; all configured ones when omitted. */
  categories?: string[];
  /** Endpoints and other per-source settings; the key is the source id. */
  /** `extractUrl`: a file with the same data, read when the endpoint is unreachable (OSM: a Geofabrik `.osm.pbf`). */
  /** `pages`: web pages a source reads, each describing one or more places (BIP MK). */
  sourceConfig: Record<string, { endpoint?: string; extractUrl?: string; pages?: SourcePage[] }>;
};

/** A part of a page: from the first line containing `from` up to the first later line containing `to`. */
export type PageSection = { from: string; to?: string };

/** A place described on a source's web page. */
export type PagePlace = {
  /** Stable id of the place within the page; part of its record ref. */
  id: string;
  name: string;
  /** Category id from the category config. */
  category: string;
  /** WGS84, taken from the OSM object `osmRef` (no paid geocoder). */
  location: { x: number; y: number };
  street: string | null;
  houseNumber: string | null;
  /** The OSM object the location comes from; when that place is in the database, the facts attach to it. */
  osmRef: string;
  /** The parts of the page about this place, in page order; the whole page when omitted. */
  sections?: PageSection[];
  /** On a page that lists places one per heading (krakow.pl toilets): this place's heading, without its number. */
  heading?: string;
};

export type SourcePage = { url: string; places: PagePlace[] };
