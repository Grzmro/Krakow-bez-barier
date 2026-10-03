import type { MapResult, SourceAdapter } from "../adapter";
import { fetchArcgisLayer, pointOf, type ArcgisFeature } from "./arcgis";

export type ZdmkParkingSpace = ArcgisFeature<{
  OBJECTID: number;
  ID_MIEJSCA?: string | null;
  /** "św. Sebastiana 7" */
  punkt_adresowy?: string | null;
}>;

const SOURCE_ID = "zdmk-parking-ozn";

/** "św. Sebastiana 7" → street + house number; an address without a number stays a street. */
export function splitAddress(raw: string | null | undefined): { street: string | null; houseNumber: string | null } {
  const address = raw?.trim();
  if (!address) return { street: null, houseNumber: null };
  const m = /^(.*\D)\s+(\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)?)$/.exec(address);
  return m ? { street: m[1].trim(), houseNumber: m[2] } : { street: address, houseNumber: null };
}

/** One record is one marked parking space for disabled drivers' vehicles. */
export function mapZdmkParkingSpace(feature: ZdmkParkingSpace): MapResult {
  const a = feature.attributes;
  const location = pointOf(feature);
  if (!location) return { place: null, skipped: [`OBJECTID=${a.OBJECTID} without geometry`] };

  const id = a.ID_MIEJSCA?.trim() || `OBJECTID_${a.OBJECTID}`;
  const ref = `${SOURCE_ID}:space/${id}`;
  const address = a.punkt_adresowy?.trim() || null;
  return {
    place: {
      externalRef: ref,
      name: address ? `Miejsce postojowe dla osób z niepełnosprawnościami: ${address}` : "Miejsce postojowe dla osób z niepełnosprawnościami",
      category: "other",
      location,
      ...splitAddress(address),
      facts: [
        {
          attribute: "disabled_parking",
          value: { kind: "boolean", boolean: true },
          recordRef: ref,
          observedAt: null,
          evidence: { comment: `ZDMK: miejsce postojowe dla osób z niepełnosprawnościami${address ? `, ${address}` : ""}` },
        },
      ],
    },
    skipped: [],
  };
}

export const zdmkParkingOzn: SourceAdapter<ZdmkParkingSpace> = {
  meta: {
    id: SOURCE_ID,
    name: "ZDMK: Miejsca postojowe dla osób z niepełnosprawnościami",
    kind: "official_open_data",
    url: "https://gmk-2.maps.arcgis.com/home/item.html?id=f0fc14687d51400aaaef0ef2c4900257",
    license: "To be confirmed (no licence in the ArcGIS item)",
    licenseConfirmed: false,
    attribution: "Zarząd Dróg Miasta Krakowa (ArcGIS Online, Gmina Miejska Kraków)",
    refreshInterval: "unknown",
    baseReliability: "confirmed",
  },
  fetch: (ctx) => fetchArcgisLayer(SOURCE_ID, ctx),
  map: mapZdmkParkingSpace,
};
