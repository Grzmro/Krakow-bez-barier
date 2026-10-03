// Client-visible configuration. Override in `.env.local` (see `.env.example`).
export const config = {
  /** MapLibre style JSON; OpenFreeMap needs no API key. */
  mapStyleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty",
  /** Copied from maplibre-gl by `scripts/copy-maplibre-worker.mjs` (predev/prebuild). */
  mapWorkerUrl: "/vendor/maplibre/maplibre-gl-worker.mjs",
  /** Reference point for distances and the initial map view — Rynek Główny, `[lon, lat]`. */
  cityCenter: [19.9373, 50.0614] as [number, number],
  initialZoom: 15,
} as const;

export const mapAttribution = [
  { label: "OpenFreeMap", href: "https://openfreemap.org" },
  { label: "© OpenMapTiles", href: "https://www.openmaptiles.org/" },
  { label: "© OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" },
] as const;
