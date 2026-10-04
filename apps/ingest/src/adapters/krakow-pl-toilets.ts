import type { FactValue } from "@krakow-bez-barier/contracts";
import type { FetchContext, MappedFact, MapResult, SourceAdapter } from "../adapter";
import { withDownloadCache } from "../cache";
import type { PagePlace } from "../cities/types";
import { retryAfterMs, SourceHttpError } from "../errors";
import { htmlLines } from "./declaration-extract";

/** One toilet of the krakow.pl list, as the page words it. */
export type ToiletEntry = {
  heading: string;
  type: string | null;
  hours: string | null;
  /** "Udogodnienia dla osób z niepełnosprawnościami", e.g. "platforma"; null when the entry has none. */
  facility: string | null;
};

export type ToiletsPage = { updatedAt: Date | null; entries: ToiletEntry[] };

/** One configured toilet with its entry on the page. */
export type KrakowPlToiletRecord = { url: string; updatedAt: string | null; entry: ToiletEntry; place: PagePlace };

const SOURCE_ID = "krakow-pl-toilets";
const LIST_INTRO = "Ogólnodostępne toalety dostosowane dla osób z niepełnosprawnościami";

const ENTRY = /^\d+\.\s*(.+)$/;
const FIELD = /^(Typ toalety|Godziny otwarcia|Udogodnienia dla osób z niepełnosprawnościami):\s*(.*)$/;

/**
 * The list on the krakow.pl "Toalety ogólnodostępne" page: one entry per numbered heading, with the
 * lines below it, and the page's update date (`<time title="Data aktualizacji">`).
 */
export function parseToiletsPage(html: string): ToiletsPage {
  const start = html.indexOf('<div class="article__description">');
  const end = html.indexOf('class="article__tags"', start);
  const lines = start >= 0 ? htmlLines(html.slice(start, end > start ? end : undefined)) : [];

  const entries: ToiletEntry[] = [];
  for (const line of lines) {
    const heading = ENTRY.exec(line);
    if (heading) {
      entries.push({ heading: heading[1].trim(), type: null, hours: null, facility: null });
      continue;
    }
    const field = FIELD.exec(line);
    const current = entries.at(-1);
    if (!field || !current) continue;
    const value = field[2].trim() || null;
    if (field[1] === "Typ toalety") current.type = value;
    else if (field[1] === "Godziny otwarcia") current.hours = value;
    else current.facility = value;
  }

  const date = /<time title="Data aktualizacji"[^>]*datetime="(\d{4}-\d{2}-\d{2})"/.exec(html)?.[1];
  const updatedAt = date ? new Date(`${date}T00:00:00Z`) : null;
  return { updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null, entries };
}

/**
 * Facts of one listed toilet. Being on the list is the city's statement that the toilet is adapted for disabled
 * people (`toilet_accessible`, `wheelchair_overall = yes`); with a stair climber ("schodołaz") only, someone has
 * to help, so the overall value is `limited`. The facility maps like the MSIP layer's `rodz_npl`.
 */
export function mapKrakowPlToilet(record: KrakowPlToiletRecord): MapResult {
  const { entry, place } = record;
  const observedAt = record.updatedAt ? new Date(record.updatedAt) : null;
  const ref = `${SOURCE_ID}:${place.id}`;
  const recordRef = record.updatedAt ? `${ref}@${record.updatedAt.slice(0, 10)}` : ref;
  const skipped: string[] = [];
  const facts: MappedFact[] = [];
  const add = (attribute: MappedFact["attribute"], value: FactValue, quote: string) =>
    facts.push({ attribute, value, recordRef, observedAt, evidence: { comment: `„${quote}”`, url: record.url } });

  const facility = entry.facility?.toLowerCase() ?? null;
  const facilityQuote = `${entry.heading} — udogodnienia dla osób z niepełnosprawnościami: ${entry.facility}`;
  const listed = `${LIST_INTRO}: ${entry.heading}`;

  add("toilet_accessible", { kind: "boolean", boolean: true }, listed);
  add("wheelchair_overall", { kind: "text", text: facility === "schodołaz" ? "limited" : "yes" }, entry.facility ? facilityQuote : listed);

  if (facility === "pochylnia") add("ramp", { kind: "boolean", boolean: true }, facilityQuote);
  else if (facility === "winda" || facility === "platforma") add("lift", { kind: "boolean", boolean: true }, facilityQuote);
  else if (facility === "wjazd z poziomu 0") add("entrance_level", { kind: "boolean", boolean: true }, facilityQuote);
  else if (facility !== null && facility !== "schodołaz") skipped.push(`${ref} udogodnienia=${entry.facility}`);

  return {
    place: {
      externalRef: ref,
      name: place.name,
      category: place.category,
      location: place.location,
      street: place.street,
      houseNumber: place.houseNumber,
      sameAs: place.osmRef,
      facts,
    },
    skipped,
  };
}

/** Pairs the configured places with their entries; a configured heading missing from the page is logged, not guessed. */
export function toiletRecords(url: string, page: ToiletsPage, places: PagePlace[], log?: (message: string) => void): KrakowPlToiletRecord[] {
  const updatedAt = page.updatedAt?.toISOString() ?? null;
  const records: KrakowPlToiletRecord[] = [];
  for (const place of places) {
    const entry = page.entries.find((e) => e.heading === place.heading);
    if (entry) records.push({ url, updatedAt, entry, place });
    else log?.(`${SOURCE_ID}: "${place.heading}" is no longer on the page`);
  }
  log?.(`${SOURCE_ID}: ${records.length} of ${page.entries.length} listed toilets matched to a place`);
  return records;
}

async function fetchToilets({ city, userAgent, log }: FetchContext): Promise<KrakowPlToiletRecord[]> {
  const [config] = city.sourceConfig[SOURCE_ID]?.pages ?? [];
  if (!config) throw new Error(`No krakow.pl toilets page configured for city ${city.id}`);

  return withDownloadCache(`${SOURCE_ID}-${city.id}`, async () => {
    const response = await fetch(config.url, {
      headers: { "User-Agent": userAgent, Accept: "text/html" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new SourceHttpError(
        `krakow.pl responded ${response.status} ${response.statusText}`,
        response.status,
        retryAfterMs(response.headers.get("Retry-After")),
      );
    }
    const page = parseToiletsPage(await response.text());
    if (page.entries.length === 0) throw new Error("krakow.pl toilets page has no list entries (layout changed?)");
    return toiletRecords(config.url, page, config.places, log);
  });
}

export const krakowPlToilets: SourceAdapter<KrakowPlToiletRecord> = {
  meta: {
    id: SOURCE_ID,
    name: "krakow.pl Kraków bez barier: Toalety ogólnodostępne",
    kind: "official_open_data",
    url: "https://www.krakow.pl/bezbarier/turystyka_sport_kultura/2780,artykul,toalety-ogolnodostepne.html",
    license:
      "Licencja niekomercyjna, do potwierdzenia: regulamin krakow.pl pozwala na użycie treści do celów niekomercyjnych; " +
      "użycie komercyjne wymaga zgody miasta",
    licenseConfirmed: true,
    termsUrl: "https://www.krakow.pl/start/3307,artykul,informacje_prawne.html",
    attribution:
      "Źródło: Urząd Miasta Krakowa, serwis krakow.pl „Kraków bez barier”, strona „Toalety ogólnodostępne” " +
      "(data aktualizacji strony przy każdym fakcie). Informacja przetworzona: wpisy z listy dopasowane do toalet z OpenStreetMap.",
    refreshInterval: "weekly",
    baseReliability: "confirmed",
  },
  fetch: fetchToilets,
  map: mapKrakowPlToilet,
};
