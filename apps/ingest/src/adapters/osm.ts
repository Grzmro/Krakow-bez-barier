import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FetchContext, SourceAdapter } from "../adapter";
import { retryAfterMs, SourceHttpError } from "../errors";
import { mapOsmElement, type OsmElement } from "./osm-map";
import { OSM_CATEGORIES } from "./osm-categories";

const CACHE_TTL_MS = 60 * 60 * 1000;

export function buildQuery(bbox: FetchContext["city"]["bbox"]): string {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const clauses = OSM_CATEGORIES.map(
    (r) => `  nwr["${r.key}"~"^(${r.values.join("|")})$"](${box});`,
  );
  return `[out:json][timeout:120];\n(\n${clauses.join("\n")}\n);\nout meta center tags;`;
}

async function readCache(file: string): Promise<OsmElement[] | null> {
  try {
    const { fetchedAt, elements } = JSON.parse(await readFile(file, "utf8"));
    return Date.now() - fetchedAt < CACHE_TTL_MS ? elements : null;
  } catch {
    return null;
  }
}

export const osm: SourceAdapter<OsmElement> = {
  meta: {
    id: "osm",
    name: "OpenStreetMap",
    kind: "community",
    url: "https://www.openstreetmap.org",
    license: "ODbL 1.0",
    termsUrl: "https://www.openstreetmap.org/copyright",
    attribution: "© OpenStreetMap contributors",
    refreshInterval: "daily",
    baseReliability: "community",
  },

  async fetch({ city, userAgent }) {
    const endpoint = process.env.OVERPASS_URL ?? city.sourceConfig.osm?.endpoint;
    if (!endpoint) throw new Error(`No Overpass endpoint configured for city ${city.id}`);

    const cacheDir = process.env.INGEST_CACHE_DIR;
    const cacheFile = cacheDir ? path.join(cacheDir, `osm-${city.id}.json`) : null;
    if (cacheFile) {
      const cached = await readCache(cacheFile);
      if (cached) return cached;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "User-Agent": userAgent, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: buildQuery(city.bbox) }),
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
    const elements = body.elements as OsmElement[];

    if (cacheFile && cacheDir) {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(cacheFile, JSON.stringify({ fetchedAt: Date.now(), elements }));
    }
    return elements;
  },

  map: mapOsmElement,
};
