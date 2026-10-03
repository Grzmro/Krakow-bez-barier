import type { FetchContext, FetchedRecords, SourceAdapter } from "../adapter";
import { withDownloadCache } from "../cache";
import { retryAfterMs, SourceHttpError } from "../errors";
import { loadOsmExtract } from "./osm-extract";
import { mapOsmElement, type OsmElement } from "./osm-map";
import { categories as configuredCategories, type CategoryConfig } from "@krakow-bez-barier/contracts";

/** Overpass QL for the categories enabled in a city (all configured ones unless the city lists a subset). */
export function buildQuery(
  bbox: FetchContext["city"]["bbox"],
  categories: readonly CategoryConfig[] = configuredCategories,
): string {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const clauses = categories.flatMap((c) =>
    c.osm.map((r) => `  nwr["${r.key}"~"^(${r.values.join("|")})$"](${box});`),
  );
  return `[out:json][timeout:120];\n(\n${clauses.join("\n")}\n);\nout meta center tags;`;
}

export function cityCategories(city: FetchContext["city"]): readonly CategoryConfig[] {
  return city.categories ? configuredCategories.filter((c) => city.categories!.includes(c.id)) : configuredCategories;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function fetchOverpass(endpoint: string, { city, userAgent }: FetchContext): Promise<OsmElement[]> {
  return withDownloadCache(`osm-${city.id}`, async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "User-Agent": userAgent, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: buildQuery(city.bbox, cityCategories(city)) }),
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
    return body.elements as OsmElement[];
  });
}

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
  const { elements, extractedAt } = await loadOsmExtract(url, ctx, cityCategories(ctx.city));
  const { note, via } = extractProvenance(extractedAt);
  return { records: elements.map((el) => ({ ...el, via })), note };
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
      return await fetchOverpass(endpoint, ctx);
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
