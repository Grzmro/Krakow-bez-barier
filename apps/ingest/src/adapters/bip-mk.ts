import type { FetchContext, MapResult, MappedFact, SourceAdapter } from "../adapter";
import { withDownloadCache } from "../cache";
import type { PagePlace } from "../cities/types";
import { retryAfterMs, SourceHttpError } from "../errors";
import { extractFacts, parseBipPage, sliceSections } from "./bip-mk-extract";

/** One place of a configured page, with the page's HTML (fetched with `&metka=1`). */
export type BipRecord = { url: string; html: string; place: PagePlace };

const SOURCE_ID = "bip-mk";
/** Pause between two page downloads: BIP MK is a public office's server, not an API. */
const PAGE_DELAY_MS = 1000;

const GMK_DISCLAIMER =
  "Gmina Miejska Kraków nie ponosi odpowiedzialności za: szkody spowodowane pozyskaniem informacji sektora publicznego " +
  "lub ponownym wykorzystywaniem informacji sektora publicznego, zamieszczonej na stronach BIP MK lub w innym miejskim " +
  "serwisie internetowym, udostępnianej na wniosek lub pozyskanej w inny sposób, wykorzystywanej ponownie z naruszeniem " +
  "warunków udostępniania lub ponownego wykorzystywania informacji sektora publicznego; szkody spowodowane przez dalsze " +
  "udostępnienie informacji sektora publicznego przez podmioty ponownie ją wykorzystujące z naruszeniem przepisów prawa " +
  "powszechnie obowiązującego, w tym dalsze udostępnianie informacji sektora publicznego z naruszeniem przepisów " +
  "regulujących ich ochronę m.in. przepisów ustawy o prawie autorskim i prawach pokrewnych, ustawy o ochronie baz danych, " +
  "przepisów o ochronie danych osobowych, ustawy o ochronie informacji niejawnych itd.";

const pageId = (url: string) => new URL(url).searchParams.get("mmi") ?? url;
const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Facts one BIP MK page states about one of its places, each with the sentence it came from and
 * the page link. `observedAt` is the page's last update from its "metka".
 */
export function mapBipPlace(record: BipRecord): MapResult {
  const { place } = record;
  const ref = `${SOURCE_ID}:page/${pageId(record.url)}/${place.id}`;
  const page = parseBipPage(record.html);
  const lines = sliceSections(page.lines, place.sections);
  if (!lines) return { place: null, skipped: [`${ref}: section not found on the page`] };

  const { facts, skipped } = extractFacts(lines);
  const observedAt = page.updatedAt ?? page.publishedAt;
  const recordRef = observedAt ? `${ref}@${day(observedAt)}` : ref;
  const mapped: MappedFact[] = facts.map((f) => ({
    attribute: f.attribute,
    value: f.value,
    recordRef,
    observedAt,
    evidence: { comment: `„${f.quote}”`, url: record.url },
  }));
  if (mapped.length === 0) return { place: null, skipped: [...skipped.map((s) => `${ref} ${s}`), `${ref}: no facts`] };

  return {
    place: {
      externalRef: ref,
      name: place.name,
      category: place.category,
      location: place.location,
      street: place.street,
      houseNumber: place.houseNumber,
      sameAs: place.osmRef,
      facts: mapped,
    },
    skipped: skipped.map((s) => `${ref} ${s}`),
  };
}

async function fetchPage(url: string, userAgent: string): Promise<string> {
  const withMetka = new URL(url);
  withMetka.searchParams.set("metka", "1");
  const response = await fetch(withMetka, {
    headers: { "User-Agent": userAgent, Accept: "text/html" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new SourceHttpError(
      `BIP MK responded ${response.status} ${response.statusText} for ${url}`,
      response.status,
      retryAfterMs(response.headers.get("Retry-After")),
    );
  }
  return response.text();
}

/**
 * Downloads the configured pages one after another. A page that fails is logged and left out (its
 * places keep their facts); the run fails only when no page could be read.
 */
async function fetchBipPages({ city, userAgent, log }: FetchContext): Promise<BipRecord[]> {
  const pages = city.sourceConfig[SOURCE_ID]?.pages ?? [];
  if (pages.length === 0) throw new Error(`No BIP MK pages configured for city ${city.id}`);

  return withDownloadCache(`${SOURCE_ID}-${city.id}`, async () => {
    const records: BipRecord[] = [];
    let firstError: unknown = null;
    for (const [i, page] of pages.entries()) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
      try {
        const html = await fetchPage(page.url, userAgent);
        for (const place of page.places) records.push({ url: page.url, html, place });
      } catch (e) {
        firstError ??= e;
        log?.(`${page.url}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (records.length === 0 && firstError) throw firstError;
    return records;
  });
}

export const bipMk: SourceAdapter<BipRecord> = {
  meta: {
    id: SOURCE_ID,
    name: "BIP Miasta Krakowa: dostępność architektoniczna",
    kind: "official_open_data",
    url: "https://www.bip.krakow.pl",
    license: "Ponowne wykorzystywanie informacji sektora publicznego GMK, pkt III — także do celów komercyjnych",
    licenseConfirmed: true,
    termsUrl: "https://www.bip.krakow.pl/?dok_id=48482",
    attribution:
      "Źródło: Biuletyn Informacji Publicznej Miasta Krakowa (www.bip.krakow.pl), strony „Dostępność architektoniczna” " +
      "jednostek miejskich; data aktualizacji strony i data pobrania są przy każdym fakcie. Informacja przetworzona: " +
      `fakty odczytane automatycznie z tekstu strony, z cytatem. ${GMK_DISCLAIMER}`,
    refreshInterval: "daily",
    baseReliability: "extracted",
  },
  fetch: fetchBipPages,
  map: mapBipPlace,
};
