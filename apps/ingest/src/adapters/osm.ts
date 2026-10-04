import { createHash } from "node:crypto";
import type { FetchContext, FetchedRecords, SourceAdapter } from "../adapter";
import { withDownloadCache } from "../cache";
import { retryAfterMs, SourceHttpError } from "../errors";
import {
  attachEntrances,
  buildEntranceQuery,
  describeEntranceStats,
  entrancesFromOverpass,
  type OsmEntrances,
  type OverpassEntranceElement,
} from "./osm-entrances";
import { loadOsmExtract } from "./osm-extract";
import { mapOsmElement, namingRelations, prepareOsmElements, type OsmElement } from "./osm-map";
import { categories as configuredCategories, type CategoryConfig } from "@krakow-bez-barier/contracts";

/** Overpass QL for the categories enabled in a city (all configured ones unless the city lists a subset). */
export function buildQuery(
  bbox: FetchContext["city"]["bbox"],
  categories: readonly CategoryConfig[] = configuredCategories,
): string {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const clauses = categories.flatMap((c) =>
    c.osm.map((r) => `  nwr["${r.key}"~"^(${r.values.join("|")})$"]${r.requires ? `["${r.requires}"]` : ""}(${box});`),
  );
  const naming = namingRelations(categories).map((n) => `  rel["${n.key}"="${n.value}"](${box});`);
  const query = `[out:json][timeout:120];\n(\n${clauses.join("\n")}\n);\nout meta center tags;`;
  // Naming relations (`stop_area`) come with their members, so unnamed platforms can take their name.
  return naming.length ? `${query}\n(\n${naming.join("\n")}\n);\nout body;` : query;
}

export function cityCategories(city: FetchContext["city"]): readonly CategoryConfig[] {
  return city.categories ? configuredCategories.filter((c) => city.categories!.includes(c.id)) : configuredCategories;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function runOverpass<T>(endpoint: string, query: string, name: string, { city, userAgent }: FetchContext): Promise<T[]> {
  // Keyed by the query too, so a cached answer to an older category list is never reused.
  const key = createHash("sha256").update(query).digest("hex").slice(0, 12);
  return withDownloadCache(`${name}-${city.id}-${key}`, async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "User-Agent": userAgent, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(150_000),
    });
    if (!response.ok) {
      throw new SourceHttpError(
        `Overpass responded ${response.status} ${response.statusText}`,
        response.status,
        retryAfterMs(response.headers.get("Retry-After")),
      );
    }
    const body = (await response.json()) as { elements?: unknown; remark?: string };
    if (!Array.isArray(body.elements)) {
      throw new Error(`Overpass returned no elements${body.remark ? `: ${body.remark}` : ""}`);
    }
    return body.elements as T[];
  });
}

const fetchOverpass = (endpoint: string, ctx: FetchContext) =>
  runOverpass<OsmElement>(endpoint, buildQuery(ctx.city.bbox, cityCategories(ctx.city)), "osm", ctx);

/**
 * Places with the entrances they take. When the entrances can't be read the places go without them, unmarked, so
 * the entrance facts of the last run stay.
 */
async function withEntrances(
  places: OsmElement[],
  load: () => Promise<OsmEntrances>,
  ctx: FetchContext,
): Promise<OsmElement[]> {
  let entrances: OsmEntrances;
  try {
    entrances = await load();
  } catch (e) {
    ctx.log?.(`entrances not read (${message(e)}), keeping the last entrance facts`);
    return places;
  }
  const attached = attachEntrances(places, entrances, cityCategories(ctx.city));
  ctx.log?.(describeEntranceStats(attached.stats));
  return attached.places;
}

const fetchOverpassEntrances = async (endpoint: string, ctx: FetchContext) =>
  entrancesFromOverpass(
    await runOverpass<OverpassEntranceElement>(endpoint, buildEntranceQuery(ctx.city.bbox), "osm-entrances", ctx),
  );

/** One error for both failures, retryable only when the extract's own error is (see `isRetryable`). */
function bothFailed(overpassError: unknown, extractError: unknown): Error {
  const text = `Overpass failed: ${message(overpassError)}; extract failed: ${message(extractError)}`;
  if (extractError instanceof SourceHttpError) {
    return new SourceHttpError(text, extractError.status, extractError.retryAfterMs);
  }
  const error = new Error(text);
  if (extractError instanceof Error) error.name = extractError.name;
  return error;
}

/** Run note and record-ref tag for data read from a Geofabrik extract, e.g. "OSM (Geofabrik, ekstrakt z 2026-10-02)". */
export function extractProvenance(extractedAt: Date | null): { note: string; via: string } {
  const day = extractedAt ? extractedAt.toISOString().slice(0, 10) : null;
  return {
    note: `OSM (Geofabrik, ekstrakt z ${day ?? "nieznanej daty"})`,
    via: `geofabrik${day ? `-${day}` : ""}`,
  };
}

async function fetchExtract(url: string, ctx: FetchContext): Promise<FetchedRecords<OsmElement>> {
  const { elements, entrances, extractedAt } = await loadOsmExtract(url, ctx, cityCategories(ctx.city));
  const { note, via } = extractProvenance(extractedAt);
  const places = prepareOsmElements(elements, cityCategories(ctx.city)).map((el) => ({ ...el, via }));
  const withVia = { ...entrances, entrances: entrances.entrances.map((e) => ({ ...e, via })) };
  return { records: await withEntrances(places, async () => withVia, ctx), note };
}

export const osm: SourceAdapter<OsmElement> = {
  meta: {
    id: "osm",
    name: "OpenStreetMap",
    kind: "community",
    url: "https://www.openstreetmap.org",
    license: "ODbL 1.0",
    licenseConfirmed: true,
    termsUrl: "https://www.openstreetmap.org/copyright",
    attribution: "© OpenStreetMap contributors",
    refreshInterval: "daily",
    baseReliability: "community",
  },

  async fetch(ctx) {
    const { city } = ctx;
    const endpoint = process.env.OVERPASS_URL ?? city.sourceConfig.osm?.endpoint;
    const extractUrl = city.sourceConfig.osm?.extractUrl;
    if (!endpoint) throw new Error(`No Overpass endpoint configured for city ${city.id}`);

    try {
      const places = prepareOsmElements(await fetchOverpass(endpoint, ctx), cityCategories(city));
      return await withEntrances(places, () => fetchOverpassEntrances(endpoint, ctx), ctx);
    } catch (overpassError) {
      if (!extractUrl) throw overpassError;
      ctx.log?.(`Overpass failed (${message(overpassError)}), falling back to the extract ${extractUrl}`);
      try {
        return await fetchExtract(extractUrl, ctx);
      } catch (extractError) {
        throw bothFailed(overpassError, extractError);
      }
    }
  },

  map: mapOsmElement,
};
