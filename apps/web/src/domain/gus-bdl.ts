import snapshot from "./gus-bdl-krakow.json";

/** Context figures for Kraków from GUS Bank Danych Lokalnych: recorded by `npm run gus:record`, never fetched per request (R5). */
export const GUS_BDL_SOURCE = {
  name: "GUS, Bank Danych Lokalnych",
  license: "CC BY 4.0",
  url: "https://bdl.stat.gov.pl",
  apiUrl: "https://bdl.stat.gov.pl/api/v1",
} as const;

// Gmina Kraków; the 2021 census (NSP) publishes disability only down to the powiat, which for Kraków is the same city.
const GMINA = "011212161011";
const POWIAT = "011212161000";

export const GUS_BDL_INDICATORS = [
  { key: "disabled", variableId: 1701558, unitId: POWIAT },
  { key: "postWorkingAge", variableId: 155, unitId: GMINA },
  { key: "population", variableId: 72305, unitId: GMINA },
  { key: "museumsAdapted", variableId: 1610486, unitId: GMINA },
  { key: "museums", variableId: 1241, unitId: GMINA },
  { key: "museumVisitors", variableId: 1243, unitId: GMINA },
] as const;

export type GusIndicatorKey = (typeof GUS_BDL_INDICATORS)[number]["key"];

export interface GusIndicator {
  key: GusIndicatorKey;
  variableId: number;
  unitId: string;
  year: number;
  value: number;
}

export interface GusSnapshot {
  fetchedAt: string;
  indicators: GusIndicator[];
}

export const gusSnapshot = snapshot as GusSnapshot;

export function gusIndicator(key: GusIndicatorKey, data: GusSnapshot = gusSnapshot): GusIndicator {
  const found = data.indicators.find((i) => i.key === key);
  if (!found) throw new Error(`GUS BDL snapshot has no "${key}"`);
  return found;
}

interface BdlByUnitResponse {
  results?: { id: number; values?: { year: string; val: number | null; attrId?: number }[] }[];
}

/** The latest year with a value for `variableId` in a BDL `/data/by-unit/{unit}` response. */
export function latestBdlValue(response: unknown, variableId: number): { year: number; value: number } {
  const row = (response as BdlByUnitResponse).results?.find((r) => r.id === variableId);
  const values = (row?.values ?? []).filter((v) => typeof v.val === "number");
  if (!values.length) throw new Error(`BDL has no value for variable ${variableId}`);
  const latest = values.reduce((a, b) => (Number(b.year) > Number(a.year) ? b : a));
  return { year: Number(latest.year), value: latest.val as number };
}
