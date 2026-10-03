import type { FetchContext, MapResult, SourceAdapter } from "../adapter";
import { withDownloadCache } from "../cache";
import type { PagePlace } from "../cities/types";
import { retryAfterMs, SourceHttpError } from "../errors";
import { htmlLines } from "./declaration-extract";
import { fetchPagesInTurn, mapPagePlace } from "./page-places";

/** One place of a configured page, with the page's HTML (fetched with `&metka=1`). */
export type BipRecord = { url: string; html: string; place: PagePlace };

/** The readable part of one BIP MK page and the dates from its "metka". */
export type BipPage = {
  /** One entry per paragraph, heading or list item, whitespace collapsed. */
  lines: string[];
  publishedAt: Date | null;
  updatedAt: Date | null;
};

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

function metkaDate(html: string, label: string): Date | null {
  const m = new RegExp(`${label}:</div>\\s*<div[^>]*>\\s*(\\d{4}-\\d{2}-\\d{2})`).exec(html);
  if (!m) return null;
  const date = new Date(`${m[1]}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Text of a BIP MK document page: everything under the page heading up to the "metka" box, one
 * line per block element. Fetch the page with `&metka=1`, otherwise the dates are not in the HTML.
 */
export function parseBipPage(html: string): BipPage {
  const heading = /<h1 class="bip">[\s\S]*?<\/h1>/.exec(html);
  const start = heading ? heading.index + heading[0].length : -1;
  const end = html.indexOf('<div class="labelBox">', start);
  const body = start >= 0 ? html.slice(start, end > start ? end : undefined) : "";
  return { lines: htmlLines(body), publishedAt: metkaDate(html, "Data publikacji"), updatedAt: metkaDate(html, "Data aktualizacji") };
}

/**
 * Facts one BIP MK page states about one of its places, each with the sentence it came from and
 * the page link. `observedAt` is the page's last update from its "metka".
 */
export function mapBipPlace(record: BipRecord): MapResult {
  const page = parseBipPage(record.html);
  const observedAt = page.updatedAt ?? page.publishedAt;
  return mapPagePlace(SOURCE_ID, pageId(record.url), { url: record.url, lines: page.lines, observedAt }, record.place);
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

/** Downloads the configured pages one after another (see `fetchPagesInTurn`). */
async function fetchBipPages({ city, userAgent, log }: FetchContext): Promise<BipRecord[]> {
  const pages = city.sourceConfig[SOURCE_ID]?.pages ?? [];
  if (pages.length === 0) throw new Error(`No BIP MK pages configured for city ${city.id}`);

  return withDownloadCache(`${SOURCE_ID}-${city.id}`, () =>
    fetchPagesInTurn(
      pages,
      PAGE_DELAY_MS,
      async (page) => {
        const html = await fetchPage(page.url, userAgent);
        return page.places.map((place) => ({ url: page.url, html, place }));
      },
      log,
    ),
  );
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
