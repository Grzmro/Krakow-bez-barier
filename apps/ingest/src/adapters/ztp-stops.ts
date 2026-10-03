import type { FactValue } from "@krakow-bez-barier/contracts";
import type { MappedFact, MapResult, SourceAdapter } from "../adapter";
import { epochDate, fetchArcgisLayer, pointOf, type ArcgisFeature } from "./arcgis";

export type ZtpStop = ArcgisFeature<{
  OBJECTID: number;
  GlobalID?: string | null;
  kod_busman?: string | null;
  Nazwa_przystanku_nr?: string | null;
  /** "KMK", "GMK", "Inny", "KMK_zawieszony" */
  Grupa?: string | null;
  Nawierzchnia_peronu?: string | null;
  /** "tak", "nie", "kassel-kerb" */
  Krawężnik_peronowy?: string | null;
  Wiata_liczba?: number | null;
  Ławki_poza_wiatą?: number | null;
  Ławki_inne_poza_wiatą?: number | null;
  Inne_do_siedzenia?: number | null;
  /** Epoch milliseconds of the last inventory edit. */
  EditDate?: number | null;
  /** Epoch milliseconds after which the platform no longer exists (e.g. a temporary stop). */
  validUntil?: number | null;
}>;

const SOURCE_ID = "ztp-stops";

/**
 * Platform surfaces in the inventory → the OSM `surface` values the app already labels. "kostka" is
 * skipped: it does not say whether it is smooth concrete blocks or stone setts.
 */
const SURFACES: Record<string, string> = {
  asfalt: "asphalt",
  beton: "concrete",
  płyty_chodnikowe: "paving_stones",
};

const count = (value: number | null | undefined) => (typeof value === "number" && value >= 0 ? value : null);

/**
 * Maps one stop (one platform) from the ZTP inventory. Benches inside a shelter are not counted
 * by the inventory, so a stop with a shelter and no other seats has no bench fact. A platform whose
 * `validUntil` is before `now` no longer exists and is skipped.
 */
export function mapZtpStop(feature: ZtpStop, now: Date = new Date()): MapResult {
  const a = feature.attributes;
  const skipped: string[] = [];
  if (a.Grupa === "KMK_zawieszony") return { place: null, skipped: [`Grupa=${a.Grupa}`] };
  const validUntil = epochDate(a.validUntil);
  if (validUntil && validUntil < now) return { place: null, skipped: [`validUntil=${validUntil.toISOString()}`] };
  const location = pointOf(feature);
  const name = a.Nazwa_przystanku_nr?.trim();
  if (!location || !name) return { place: null, skipped: [`OBJECTID=${a.OBJECTID} without geometry or name`] };

  const id = a.kod_busman?.trim() || a.GlobalID?.trim() || `OBJECTID_${a.OBJECTID}`;
  const ref = `${SOURCE_ID}:stop/${id}`;
  const observedAt = epochDate(a.EditDate);
  const facts: MappedFact[] = [];
  const add = (attribute: MappedFact["attribute"], value: FactValue, comment: string) =>
    facts.push({ attribute, value, recordRef: ref, observedAt, evidence: { comment } });

  const seatCounts = [a.Ławki_poza_wiatą, a.Ławki_inne_poza_wiatą, a.Inne_do_siedzenia].map(count);
  const shelters = count(a.Wiata_liczba);
  if (seatCounts.every((n) => n !== null)) {
    const seats = seatCounts.reduce<number>((sum, n) => sum + (n ?? 0), 0);
    if (seats > 0) add("bench", { kind: "boolean", boolean: true }, `ZTP: ławki poza wiatą: ${seats}`);
    else if (shelters === 0) add("bench", { kind: "boolean", boolean: false }, "ZTP: brak wiaty i ławek");
  }

  const surface = a.Nawierzchnia_peronu?.trim();
  if (surface) {
    if (SURFACES[surface]) add("surface", { kind: "text", text: SURFACES[surface] }, `ZTP: nawierzchnia peronu: ${surface}`);
    else skipped.push(`Nawierzchnia_peronu=${surface}`);
  }

  // No kerb value maps to the vocabulary: the inventory gives no kerb height, even for a Kassel kerb.
  const kerb = a.Krawężnik_peronowy?.trim();
  if (kerb) skipped.push(`Krawężnik_peronowy=${kerb}`);

  return {
    place: {
      externalRef: ref,
      name: `Przystanek ${name}`,
      category: "transit_stop",
      location,
      street: null,
      houseNumber: null,
      facts,
    },
    skipped,
  };
}

export const ztpStops: SourceAdapter<ZtpStop> = {
  meta: {
    id: SOURCE_ID,
    name: "ZTP: Przystanki komunikacji miejskiej",
    kind: "official_open_data",
    url: "https://gmk-2.maps.arcgis.com/home/item.html?id=73cfc1778d0d4305a643ef0d2cb13e1f",
    license: "To be confirmed (no licence in the ArcGIS item)",
    licenseConfirmed: false,
    attribution: "Zarząd Transportu Publicznego w Krakowie",
    refreshInterval: "unknown",
    baseReliability: "confirmed",
  },
  fetch: (ctx) => fetchArcgisLayer(SOURCE_ID, ctx),
  map: (record) => mapZtpStop(record),
};
