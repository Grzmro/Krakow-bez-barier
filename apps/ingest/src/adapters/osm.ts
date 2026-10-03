import type { FetchContext, SourceAdapter } from "../adapter";
import { withDownloadCache } from "../cache";
import { retryAfterMs, SourceHttpError } from "../errors";
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

  async fetch({ city, userAgent }) {
    const endpoint = process.env.OVERPASS_URL ?? city.sourceConfig.osm?.endpoint;
    if (!endpoint) throw new Error(`No Overpass endpoint configured for city ${city.id}`);

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
  },

  map: mapOsmElement,
};
