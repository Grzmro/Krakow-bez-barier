import type { MapResult, MappedFact } from "../adapter";
import type { PagePlace, SourcePage } from "../cities/types";
import { extractFacts, sliceSections } from "./declaration-extract";

/** The readable text of a page that describes places in free text, and when the page says it was last changed. */
export type PageText = { url: string; lines: string[]; observedAt: Date | null };

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Facts one page states about one of its places, read from the place's sections sentence by sentence. Each fact
 * quotes its sentence and links the page; the record ref is `<source>:page/<pageKey>/<place>@<page date>`.
 */
export function mapPagePlace(sourceId: string, pageKey: string, page: PageText, place: PagePlace): MapResult {
  const ref = `${sourceId}:page/${pageKey}/${place.id}`;
  const lines = sliceSections(page.lines, place.sections);
  if (!lines) return { place: null, skipped: [`${ref}: section not found on the page`] };

  const { facts, skipped } = extractFacts(lines);
  const { observedAt } = page;
  const recordRef = observedAt ? `${ref}@${day(observedAt)}` : ref;
  const mapped: MappedFact[] = facts.map((f) => ({
    attribute: f.attribute,
    value: f.value,
    recordRef,
    observedAt,
    evidence: { comment: `„${f.quote}”`, url: page.url },
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

/**
 * Reads the pages one after another, `delayMs` apart: the servers are public offices', not APIs. A page that
 * fails is logged and left out (its places keep their facts); the run fails only when no page could be read.
 */
export async function fetchPagesInTurn<R>(
  pages: SourcePage[],
  delayMs: number,
  read: (page: SourcePage) => Promise<R[]>,
  log?: (message: string) => void,
): Promise<R[]> {
  const records: R[] = [];
  let firstError: unknown = null;
  for (const [i, page] of pages.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      records.push(...(await read(page)));
    } catch (e) {
      firstError ??= e;
      log?.(`${page.url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (records.length === 0 && firstError) throw firstError;
  return records;
}
