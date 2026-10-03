import type { Map as MapLibreMap } from "maplibre-gl";

type ImageHost = Pick<MapLibreMap, "setMissingStyleImageResolver" | "hasImage" | "addImage">;

/**
 * The basemap style names POI icons its sprite lacks (gate, bollard, atm, office…). Each one resolves to a
 * transparent pixel, so those POIs draw their label only — as before — without a `styleimagemissing`
 * event or a console warning per icon.
 */
export function blankMissingImages(map: ImageHost) {
  map.setMissingStyleImageResolver((id) => {
    if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
}
