// Client-visible configuration. Override in `.env.local` (see `.env.example`).
export const config = {
  /** MapLibre style JSON; OpenFreeMap needs no API key. */
  mapStyleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty",
  /** Copied from maplibre-gl by `scripts/copy-maplibre-worker.mjs` (predev/prebuild). */
  mapWorkerUrl: "/vendor/maplibre/maplibre-gl-worker.mjs",
  /** Reference point for distances, the initial map view and the places listed first — Rynek Główny, `[lon, lat]`. */
  cityCenter: [19.9373, 50.0614] as [number, number],
  initialZoom: 15,
  /** Default start and end of the route screen, `[lon, lat]`: the station's main exit and the Rynek. */
  routeStart: [19.9461, 50.0668] as [number, number],
  routeEnd: [19.9373, 50.0617] as [number, number],
  /** E-mail the city's "Zgłoś miastu" report goes to (ZDMK/ZTP); unset until the owner confirms it, then the button only copies. Build-time. */
  cityReportAddress: process.env.NEXT_PUBLIC_CITY_REPORT_ADDRESS?.trim() ?? "",
} as const;

export const mapAttribution = [
  { label: "OpenFreeMap", href: "https://openfreemap.org" },
  { label: "© OpenMapTiles", href: "https://www.openmaptiles.org/" },
  { label: "© OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" },
] as const;
