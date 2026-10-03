import type { FactValue } from "@krakow-bez-barier/contracts";
import type { MappedFact, MapResult, SourceAdapter } from "../adapter";
import { fetchArcgisLayer, pointOf, type ArcgisFeature } from "./arcgis";

export type MsipToilet = ArcgisFeature<{
  ESRI_OID: number;
  miejsce?: string | null;
  /** "Tak", "tak, po stronie damskiej", "nie", ... */
  nplnsprw?: string | null;
  /** "wjazd z poziomu 0", "platforma", "winda", "schodołaz", "pochylnia", "-" */
  rodz_npl?: string | null;
  /** "Tak" / "brak" */
  przewijak?: string | null;
  /** "czynne" / "nie" */
  status?: string | null;
}>;

const SOURCE_ID = "msip-toilets";
const LAYER = "WT_WC_2023";

/**
 * `nplnsprw` wording → OSM `wheelchair`. "po stronie damskiej" puts the accessible cubicle on the
 * women's side only, so it is `limited`; "oddzielnie" and "pomiędzy …" mean a separate cubicle.
 */
const ACCESS: Record<string, string> = {
  tak: "yes",
  "tak, oddzielnie": "yes",
  "tak, pomiędzy toaletą damską a męską": "yes",
  "tak, po stronie damskiej": "limited",
  nie: "no",
};

const clean = (value: string | null | undefined) => value?.trim() || null;
const lower = (value: string | null | undefined) => clean(value)?.toLowerCase() ?? null;

/** The layer marks some locations with a trailing " N"; it is not part of the address. */
const placeName = (miejsce: string | null) => {
  const location = miejsce?.replace(/\s*N\s*$/, "").trim();
  return location ? `Toaleta publiczna: ${location}` : "Toaleta publiczna";
};

/**
 * Maps one MSIP public-toilet record; a closed toilet (`status = "nie"`) is skipped. The layer has no per-record date, so `observedAt` stays
 * empty; the original wording goes into the evidence comment.
 */
export function mapMsipToilet(feature: MsipToilet): MapResult {
  const a = feature.attributes;
  const skipped: string[] = [];
  const location = pointOf(feature);
  if (!location) return { place: null, skipped: [`ESRI_OID=${a.ESRI_OID} without geometry`] };
  if (lower(a.status) === "nie") return { place: null, skipped: [`status=${a.status}`] };

  const ref = `${SOURCE_ID}:${LAYER}/${a.ESRI_OID}`;
  const facts: MappedFact[] = [];
  const add = (attribute: MappedFact["attribute"], value: FactValue, comment: string) =>
    facts.push({ attribute, value, recordRef: ref, observedAt: null, evidence: { comment } });

  const access = lower(a.nplnsprw);
  const modification = lower(a.rodz_npl);
  const modificationNote = modification && modification !== "-" ? `; modyfikacja: ${clean(a.rodz_npl)}` : "";
  if (access !== null) {
    const comment = `MSIP: dostępność dla niepełnosprawnych: ${clean(a.nplnsprw)}${modificationNote}`;
    const overall = ACCESS[access];
    if (overall) add("wheelchair_overall", { kind: "text", text: overall }, comment);
    else skipped.push(`nplnsprw=${a.nplnsprw}`);
  }

  if (modification !== null && modification !== "-") {
    const comment = `MSIP: rodzaj modyfikacji: ${clean(a.rodz_npl)}`;
    if (modification === "pochylnia") add("ramp", { kind: "boolean", boolean: true }, comment);
    else if (modification === "winda" || modification === "platforma") add("lift", { kind: "boolean", boolean: true }, comment);
    else if (modification === "wjazd z poziomu 0") add("entrance_level", { kind: "boolean", boolean: true }, comment);
    else skipped.push(`rodz_npl=${a.rodz_npl}`);
  }

  const changingTable = lower(a.przewijak);
  if (changingTable !== null) {
    const comment = `MSIP: obecność przewijaka: ${clean(a.przewijak)}`;
    if (changingTable === "tak") add("changing_table", { kind: "boolean", boolean: true }, comment);
    else if (changingTable === "brak" || changingTable === "nie") add("changing_table", { kind: "boolean", boolean: false }, comment);
    else skipped.push(`przewijak=${a.przewijak}`);
  }

  return {
    place: {
      externalRef: ref,
      name: placeName(clean(a.miejsce)),
      category: "toilet",
      location,
      street: null,
      houseNumber: null,
      facts,
    },
    skipped,
  };
}

export const msipToilets: SourceAdapter<MsipToilet> = {
  meta: {
    id: SOURCE_ID,
    name: "MSIP: Toalety publiczne",
    kind: "official_open_data",
    url: "https://msip.um.krakow.pl/arcgis/rest/services/Obserwatorium/WT_WC_2023/MapServer/0",
    license: "To be confirmed",
    licenseConfirmed: false,
    termsUrl: "https://msip.krakow.pl/?dok_id=228972",
    attribution: "Gmina Miejska Kraków, Portal MSIP Obserwatorium (https://msip.krakow.pl)",
    refreshInterval: "unknown",
    baseReliability: "confirmed",
  },
  fetch: (ctx) => fetchArcgisLayer(SOURCE_ID, ctx),
  map: mapMsipToilet,
};
