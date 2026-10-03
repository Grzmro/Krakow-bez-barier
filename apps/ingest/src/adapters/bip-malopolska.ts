import type { FetchContext, MapResult, SourceAdapter } from "../adapter";
import { withDownloadCache } from "../cache";
import type { PagePlace, SourcePage } from "../cities/types";
import { retryAfterMs, SourceHttpError } from "../errors";
import { declarationArchitecture, sentences } from "./declaration-extract";
import { fetchPagesInTurn, mapPagePlace } from "./page-places";

/** The fields of `GET <api>/contexts/<unit>/accessibility-declaration` that we read. */
export type Declaration = {
  /** Last change of the declaration, `YYYY-MM-DD HH:mm:ss`. */
  modifyDate: string | null;
  /** The declaration as HTML from the official template (`#a11y-architektura` etc.). */
  content: string;
};

/** One configured place with the declaration of the unit that describes it. */
export type DeclarationRecord = { url: string; declaration: Declaration; place: PagePlace };

const SOURCE_ID = "bip-malopolska";
const PAGE_DELAY_MS = 1000;

/** `https://bip.malopolska.pl/muw,e,deklaracja.html` → `muw`: the unit's id in the BIP (its "context"). */
export function unitOf(url: string): string {
  const unit = /^\/([^/,]+),e,deklaracja\.html$/.exec(new URL(url).pathname)?.[1];
  if (!unit) throw new Error(`Not a bip.malopolska.pl declaration page: ${url}`);
  return unit;
}

function dateOf(modifyDate: string | null): Date | null {
  const day = modifyDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const date = day ? new Date(`${day}T00:00:00Z`) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/**
 * Facts the declaration's "Dostępność architektoniczna" part states about one configured place, each quoting its
 * sentence and linking the declaration. `observedAt` is the declaration's last change. Sections are matched per
 * sentence, not per paragraph: editors often put two buildings in one paragraph.
 */
export function mapDeclarationPlace(record: DeclarationRecord): MapResult {
  const { url, declaration, place } = record;
  const lines = sentences(declarationArchitecture(declaration.content));
  if (lines.length === 0) return { place: null, skipped: [`${SOURCE_ID}:page/${unitOf(url)}/${place.id}: no architecture part`] };
  return mapPagePlace(SOURCE_ID, unitOf(url), { url, lines, observedAt: dateOf(declaration.modifyDate) }, place);
}

async function fetchDeclaration(api: string, unit: string, userAgent: string): Promise<Declaration> {
  const url = new URL(`contexts/${encodeURIComponent(unit)}/accessibility-declaration`, api);
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new SourceHttpError(
      `BIP Małopolska responded ${response.status} ${response.statusText} for ${unit}`,
      response.status,
      retryAfterMs(response.headers.get("Retry-After")),
    );
  }
  const body = (await response.json()) as Partial<Declaration>;
  if (typeof body.content !== "string") throw new Error(`BIP Małopolska: no declaration content for ${unit}`);
  return { modifyDate: body.modifyDate ?? null, content: body.content };
}

/** Configured pages whose publisher's reuse terms are confirmed; the others are logged and not fetched. */
export function licensedPages(pages: SourcePage[], log?: (message: string) => void): SourcePage[] {
  return pages.filter((page) => {
    if (page.license?.confirmed) return true;
    log?.(`${page.url}: reuse terms not confirmed (${page.license?.terms ?? "none recorded"}), not fetched`);
    return false;
  });
}

async function fetchDeclarations({ city, userAgent, log }: FetchContext): Promise<DeclarationRecord[]> {
  const config = city.sourceConfig[SOURCE_ID];
  const pages = licensedPages(config?.pages ?? [], log);
  if (!config?.endpoint || pages.length === 0) {
    throw new Error(`No BIP Małopolska declarations with confirmed reuse terms configured for city ${city.id}`);
  }
  const api = config.endpoint;

  return withDownloadCache(`${SOURCE_ID}-${city.id}`, () =>
    fetchPagesInTurn(
      pages,
      PAGE_DELAY_MS,
      async (page) => {
        const declaration = await fetchDeclaration(api, unitOf(page.url), userAgent);
        return page.places.map((place) => ({ url: page.url, declaration, place }));
      },
      log,
    ),
  );
}

export const bipMalopolska: SourceAdapter<DeclarationRecord> = {
  meta: {
    id: SOURCE_ID,
    name: "BIP Małopolska: deklaracje dostępności podmiotów publicznych",
    kind: "venue_owner",
    url: "https://bip.malopolska.pl",
    license:
      "Informacja sektora publicznego w BIP — ponowne wykorzystywanie bez wniosku (ustawa z 11 sierpnia 2021 r. o otwartych " +
      "danych i ponownym wykorzystywaniu informacji sektora publicznego); tylko deklaracje podmiotów, do których ustawa ma " +
      "zastosowanie i które nie określiły odrębnych warunków",
    licenseConfirmed: true,
    termsUrl: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20210001641",
    attribution:
      "Źródło: Regionalny System Biuletynów Informacji Publicznej w Małopolsce (bip.malopolska.pl), deklaracje dostępności " +
      "podmiotów, część „Dostępność architektoniczna”; link do deklaracji, data jej ostatniej zmiany i data pobrania są przy " +
      "każdym fakcie. Informacja przetworzona: fakty odczytane automatycznie z tekstu deklaracji, z cytatem.",
    refreshInterval: "daily",
    baseReliability: "extracted",
  },
  fetch: fetchDeclarations,
  map: mapDeclarationPlace,
};
