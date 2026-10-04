import type { Bbox } from "../cities/types";
import type { FetchContext, MapResult, SourceAdapter } from "../adapter";
import { withDownloadCache } from "../cache";
import { retryAfterMs, SourceHttpError } from "../errors";
import { namesMatch } from "../store";
import type { OsmElement } from "./osm-map";

const SOURCE_ID = "rejestr-aptek";

/**
 * One pharmacy of the Rejestr Aptek, reduced to what identifies and locates it. The register also names the
 * manager and, for sole traders, the owner: those columns are never read.
 */
export type RegisterPharmacy = {
  id: string;
  name: string;
  /** `stan_apteki`, e.g. "AKTYWNA", "NIEAKTYWNA", "CZASOWO NIECZYNNA". */
  status: string;
  /** `rodzaj_apteki`, e.g. "APTEKA OGÓLNODOSTĘPNA", "PUNKT APTECZNY", "DZIAŁ FARMACJI SZPITALNEJ". */
  kind: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  town: string;
  county: string;
};

type Point = { x: number; y: number };

export type OsmPharmacy = { ref: string; name: string; location: Point; street: string | null; houseNumber: string | null };

/** An OSM object with an address: `addr:street` (or `addr:place` for the Nowa Huta "osiedla") + `addr:housenumber`. */
export type AddressPoint = { street: string; houseNumber: string; location: Point };

export type OsmIndex = { pharmacies: OsmPharmacy[]; addresses: AddressPoint[] };

/** How a register pharmacy was placed: on an OSM pharmacy, on an OSM address point (a new place), or not at all. */
export type Resolution =
  | { kind: "osm"; ref: string; location: Point; by: "address" | "name" | "distance" }
  | { kind: "address"; location: Point }
  | { kind: "none" };

export type RejestrAptekRecord = { pharmacy: RegisterPharmacy; resolution: Resolution };

/** Columns read from the register; everything else (manager, owner, permits) is dropped while parsing. */
const COLUMNS = {
  id: "identyfikator_apteki",
  name: "nazwa_apteki",
  status: "stan_apteki",
  kind: "rodzaj_apteki",
  street: "nazwa_ulicy",
  houseNumber: "numer_budynku",
  postalCode: "kod_pocztowy",
  town: "miejscowosc",
  county: "powiat",
} as const satisfies Record<keyof RegisterPharmacy, string>;

/** One line of the register's export: `|`-separated, a field in double quotes when it has quotes (`""` inside). */
function splitLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let value = "";
      i += 1;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          value += '"';
          i += 2;
        } else if (line[i] === '"') {
          i += 1;
          break;
        } else {
          value += line[i++];
        }
      }
      const end = line.indexOf("|", i);
      fields.push(value);
      i = end < 0 ? line.length + 1 : end + 1;
    } else {
      const end = line.indexOf("|", i);
      fields.push(line.slice(i, end < 0 ? line.length : end));
      i = end < 0 ? line.length + 1 : end + 1;
    }
  }
  return fields;
}

/** The register's CSV export (`api/ra/filegenerator/getcsv`), keeping only the columns in `COLUMNS`. */
export function parseRegisterCsv(text: string): RegisterPharmacy[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const header = splitLine(lines[0]);
  const index = Object.fromEntries(Object.entries(COLUMNS).map(([key, column]) => [key, header.indexOf(column)])) as Record<
    keyof RegisterPharmacy,
    number
  >;
  const missing = Object.entries(index).filter(([, i]) => i < 0).map(([key]) => COLUMNS[key as keyof RegisterPharmacy]);
  if (missing.length > 0) throw new Error(`Rejestr Aptek export has no column(s) ${missing.join(", ")} (format changed?)`);

  return lines.slice(1).map((line, i) => {
    const fields = splitLine(line);
    // A line break inside a quoted field would shift the address columns: fail rather than misplace pharmacies.
    if (fields.length !== header.length) throw new Error(`Rejestr Aptek export line ${i + 2} has ${fields.length} of ${header.length} fields`);
    return Object.fromEntries(Object.entries(index).map(([key, i]) => [key, (fields[i] ?? "").trim()])) as RegisterPharmacy;
  });
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/gi, "l").toLowerCase();

/** A pharmacy open to the public that the register lists as operating, in the city's own county (powiat). */
export function isOperatingInCity(p: RegisterPharmacy, cityName: string): boolean {
  return (
    p.status === "AKTYWNA" &&
    (p.kind === "APTEKA OGÓLNODOSTĘPNA" || p.kind === "PUNKT APTECZNY") &&
    fold(p.county) === fold(cityName)
  );
}

// Street-type words and titles that one source writes and the other leaves out ("Aleja gen. Tadeusza Bora-Komorowskiego").
const STREET_NOISE = new Set([
  "ul", "ulica", "al", "aleja", "aleje", "os", "osiedle", "pl", "plac", "rynek", "gen", "generala", "plk", "pulkownika",
  "prof", "profesora", "ks", "ksiedza", "sw", "swietego", "swietej", "dr", "doktora", "mjr", "majora", "kpt", "kapitana",
  "marsz", "marszalka", "im", "imienia", "abp", "arcybiskupa", "bp", "biskupa", "kard", "kardynala",
]);

const streetTokens = (street: string) => fold(street).split(/[^a-z0-9]+/).filter((t) => t && !STREET_NOISE.has(t));

/**
 * Street name for comparing across sources: folded, without street types and titles, words sorted — the register
 * sometimes puts the surname first ("Traugutta Romualda" for "Romualda Traugutta").
 */
export function streetKey(street: string): string {
  return streetTokens(street).sort().join(" ");
}

const numberKey = (n: string) => n.toUpperCase().replace(/\s+/g, "");
const addressKey = (street: string, houseNumber: string) => `${streetKey(street)}|${numberKey(houseNumber)}`;
const surnameKey = (street: string, houseNumber: string) => `${streetTokens(street).at(-1)}|${numberKey(houseNumber)}`;

/** The pharmacy's own name without "apteka" and legal-form words, for comparing names of one pharmacy across sources. */
function brand(name: string): string {
  return fold(name)
    .replace(/\b(apteka|apteki|punkt apteczny|ogolnodostepna|s ?c|sp ?j|sp z o ?o)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const METRES_PER_DEGREE = 111_320;
function distanceM(a: Point, b: Point): number {
  const dy = (a.y - b.y) * METRES_PER_DEGREE;
  const dx = (a.x - b.x) * METRES_PER_DEGREE * Math.cos((((a.y + b.y) / 2) * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

/** Within this distance an OSM pharmacy of the same name is the register's pharmacy (a big building's address point can be 100 m from its door). */
export const NAME_MATCH_METRES = 150;
/** Within this distance the OSM pharmacy is taken as the register's one whatever its name (a renamed or unnamed node). */
export const NEAREST_MATCH_METRES = 25;
/** Address points of one address closer than this are one spot (a building and its entrance). */
const SAME_SPOT_METRES = 60;

/** The OSM pharmacies and address points from one Overpass answer; address points outside the city are dropped. */
export function indexOsm(elements: OsmElement[], cityName: string): OsmIndex {
  const pharmacies: OsmPharmacy[] = [];
  const addresses: AddressPoint[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const location = { x: lon, y: lat };
    const street = tags["addr:street"] ?? tags["addr:place"] ?? null;
    const houseNumber = tags["addr:housenumber"] ?? null;
    if (tags.amenity === "pharmacy" || tags.healthcare === "pharmacy") {
      pharmacies.push({ ref: `osm:${el.type}/${el.id}`, name: tags.name ?? "", location, street, houseNumber });
    }
    const city = tags["addr:city"];
    if (street && houseNumber && (!city || fold(city) === fold(cityName))) addresses.push({ street, houseNumber, location });
  }
  return { pharmacies, addresses };
}

/**
 * Places a register pharmacy without a paid geocoder. Its address is looked up among OSM address points (exact
 * street and number, else the street's last word and the number when that points to one spot). Then, in order:
 * an OSM pharmacy with the same address; the nearest OSM pharmacy of the same name within `NAME_MATCH_METRES`;
 * the nearest OSM pharmacy within `NEAREST_MATCH_METRES`; else the address point itself, as a new place.
 */
export function resolvePharmacy(p: RegisterPharmacy, osm: OsmIndex): Resolution {
  if (!streetKey(p.street) || !numberKey(p.houseNumber)) return { kind: "none" };
  const key = addressKey(p.street, p.houseNumber);
  const own = brand(p.name);
  const atAddress = osm.pharmacies.filter((o) => o.street && o.houseNumber && addressKey(o.street, o.houseNumber) === key);
  // A shopping centre has several pharmacies under one address: the same name wins, a differently named one is not taken.
  const sameAddress =
    atAddress.find((o) => own && brand(o.name) && namesMatch(brand(o.name), own)) ??
    atAddress.find((o) => !own || !brand(o.name));
  if (sameAddress) return { kind: "osm", ref: sameAddress.ref, location: sameAddress.location, by: "address" };

  const point = geocode(p, osm.addresses);
  if (!point) return { kind: "none" };

  const nearby = osm.pharmacies
    .map((o) => ({ o, d: distanceM(o.location, point) }))
    .filter(({ d }) => d <= NAME_MATCH_METRES)
    .sort((a, b) => a.d - b.d);
  const named = own ? nearby.find(({ o }) => brand(o.name) && namesMatch(brand(o.name), own)) : undefined;
  if (named) return { kind: "osm", ref: named.o.ref, location: named.o.location, by: "name" };
  // Two different names this close can be two pharmacies (a shopping centre): only a nameless one is taken.
  const nearest = nearby[0];
  if (nearest && nearest.d <= NEAREST_MATCH_METRES && (!own || !brand(nearest.o.name))) {
    return { kind: "osm", ref: nearest.o.ref, location: nearest.o.location, by: "distance" };
  }
  return { kind: "address", location: point };
}

function geocode(p: RegisterPharmacy, addresses: AddressPoint[]): Point | null {
  const key = addressKey(p.street, p.houseNumber);
  const exact = addresses.find((a) => addressKey(a.street, a.houseNumber) === key);
  if (exact) return exact.location;
  const surname = surnameKey(p.street, p.houseNumber);
  const loose = addresses.filter((a) => surnameKey(a.street, a.houseNumber) === surname);
  // The same last word and number on two streets far apart ("Krakowska 1" vs "Nowa Krakowska 1"): no guess.
  if (loose.length > 0 && loose.every((a) => distanceM(a.location, loose[0].location) <= SAME_SPOT_METRES)) {
    return loose[0].location;
  }
  return null;
}

/** OSM pharmacies in the city box and the address points on the register's streets (by each street's longest word). */
export function buildOsmQuery(bbox: Bbox, pharmacies: RegisterPharmacy[]): string {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const words = new Set<string>();
  for (const p of pharmacies) {
    const longest = p.street.split(/[^\p{L}\p{N}]+/u).filter((w) => !STREET_NOISE.has(fold(w))).sort((a, b) => b.length - a.length)[0];
    if (longest && longest.length >= 3) words.add(longest);
  }
  const streets = [...words].sort().join("|");
  const lines = [`  nwr["amenity"="pharmacy"](${box});`, `  nwr["healthcare"="pharmacy"](${box});`];
  if (streets) {
    lines.push(`  nwr["addr:housenumber"]["addr:street"~"(${streets})",i](${box});`);
    lines.push(`  nwr["addr:housenumber"]["addr:place"~"(${streets})",i](${box});`);
  }
  return `[out:json][timeout:180];\n(\n${lines.join("\n")}\n);\nout center tags;`;
}

const externalRef = (p: RegisterPharmacy) => `${SOURCE_ID}:apteka/${p.id}`;

/** The register's name without wrapping quotes („Dr. Max”); an unnamed pharmacy is "Apteka", never its owner's name. */
const displayName = (name: string) => name.replace(/^[„"”]+|[„"”]+$/g, "").trim() || "Apteka";

/**
 * A register pharmacy as a place, without facts: the register says nothing about access, so nothing is guessed.
 * On an OSM pharmacy it points there (`sameAs`); otherwise it is a new place at the OSM address point. Not placed
 * → no place, counted as skipped.
 */
export function mapRejestrApteka({ pharmacy: p, resolution }: RejestrAptekRecord): MapResult {
  if (resolution.kind === "none") {
    return { place: null, skipped: [`${externalRef(p)} adres=${p.street} ${p.houseNumber} (brak punktu adresowego w OSM)`] };
  }
  return {
    place: {
      externalRef: externalRef(p),
      name: displayName(p.name),
      category: "pharmacy",
      location: resolution.location,
      street: p.street || null,
      houseNumber: p.houseNumber || null,
      sameAs: resolution.kind === "osm" ? resolution.ref : undefined,
      facts: [],
    },
    skipped: [],
  };
}

/** Pairs each operating pharmacy with its placement and logs the counts the run report needs. */
export function resolveRecords(
  pharmacies: RegisterPharmacy[],
  osm: OsmIndex,
  log?: (message: string) => void,
): RejestrAptekRecord[] {
  const records = pharmacies.map((pharmacy) => ({ pharmacy, resolution: resolvePharmacy(pharmacy, osm) }));
  const count = (test: (r: Resolution) => boolean) => records.filter((r) => test(r.resolution)).length;
  const by = (how: string) => count((r) => r.kind === "osm" && r.by === how);
  log?.(
    `${SOURCE_ID}: ${records.length} operating pharmacies; on an OSM pharmacy ${count((r) => r.kind === "osm")} ` +
      `(address ${by("address")}, name ${by("name")}, distance ${by("distance")}), new at an OSM address point ` +
      `${count((r) => r.kind === "address")}, not placed ${count((r) => r.kind === "none")} ` +
      `(of ${osm.pharmacies.length} OSM pharmacies, ${osm.addresses.length} address points)`,
  );
  return records;
}

async function download(url: string, init: RequestInit, what: string): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new SourceHttpError(`${what} responded ${response.status} ${response.statusText}`, response.status, retryAfterMs(response.headers.get("Retry-After")));
  }
  return response;
}

async function fetchRegister({ city, userAgent, log }: FetchContext): Promise<RejestrAptekRecord[]> {
  const endpoint = city.sourceConfig[SOURCE_ID]?.endpoint;
  const overpass = process.env.OVERPASS_URL ?? city.sourceConfig.osm?.endpoint;
  if (!endpoint) throw new Error(`No Rejestr Aptek export configured for city ${city.id}`);
  if (!overpass) throw new Error(`No Overpass endpoint configured for city ${city.id} (needed to place pharmacies)`);

  const pharmacies = await withDownloadCache(`${SOURCE_ID}-${city.id}`, async () => {
    const response = await download(endpoint, { headers: { "User-Agent": userAgent, Accept: "text/csv" }, signal: AbortSignal.timeout(300_000) }, "Rejestr Aptek");
    const all = parseRegisterCsv(await response.text());
    if (all.length === 0) throw new Error("Rejestr Aptek export is empty");
    const inCity = all.filter((p) => fold(p.county) === fold(city.name));
    const operating = inCity.filter((p) => isOperatingInCity(p, city.name));
    log?.(`${SOURCE_ID}: ${all.length} register entries, ${inCity.length} in ${city.name}, ${operating.length} operating and open to the public`);
    return operating;
  });
  if (pharmacies.length === 0) throw new Error(`Rejestr Aptek lists no operating pharmacy in ${city.name}`);

  const query = buildOsmQuery(city.bbox, pharmacies);
  const elements = await withDownloadCache(`${SOURCE_ID}-osm-${city.id}`, async () => {
    const response = await download(
      overpass,
      {
        method: "POST",
        headers: { "User-Agent": userAgent, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(200_000),
      },
      "Overpass",
    );
    const body = (await response.json()) as { elements?: unknown; remark?: string };
    if (!Array.isArray(body.elements)) throw new Error(`Overpass returned no elements${body.remark ? `: ${body.remark}` : ""}`);
    return body.elements as OsmElement[];
  });
  return resolveRecords(pharmacies, indexOsm(elements, city.name), log);
}

export const rejestrAptek: SourceAdapter<RejestrAptekRecord> = {
  meta: {
    id: SOURCE_ID,
    name: "Rejestr Aptek (Centrum e-Zdrowia)",
    kind: "official_open_data",
    url: "https://dane.gov.pl/pl/dataset/1925,rejestr-aptek",
    license: "CC BY 4.0 (dane.gov.pl, zbiór „Rejestr Aptek”, Centrum e-Zdrowia)",
    licenseConfirmed: true,
    termsUrl: "https://creativecommons.org/licenses/by/4.0/deed.pl",
    attribution:
      "Źródło: Rejestr Aptek, Centrum e-Zdrowia (dane.gov.pl, CC BY 4.0). Informacja przetworzona: tylko apteki " +
      "czynne według rejestru, dopasowane do aptek z OpenStreetMap; położenie nowych aptek z punktów adresowych " +
      "OpenStreetMap (© OpenStreetMap contributors, ODbL).",
    refreshInterval: "weekly",
    baseReliability: "confirmed",
  },
  fetch: fetchRegister,
  map: mapRejestrApteka,
};
