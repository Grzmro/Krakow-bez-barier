import type { FetchContext } from "../adapter";
import { withDownloadCache } from "../cache";
import { retryAfterMs, SourceHttpError } from "../errors";

export type ArcgisFeature<A> = {
  attributes: A;
  /** WGS84 when queried with `outSR=4326`. */
  geometry?: { x: number; y: number } | null;
};

type QueryResponse<A> = {
  features?: ArcgisFeature<A>[];
  exceededTransferLimit?: boolean;
  error?: { code?: number; message?: string };
};

export function buildLayerQuery(layerUrl: string, bbox: FetchContext["city"]["bbox"]): string {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    returnGeometry: "true",
    geometry: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outSR: "4326",
    f: "json",
  });
  return `${layerUrl.replace(/\/+$/, "")}/query?${params}`;
}

/**
 * Reads every point of one ArcGIS REST feature layer inside the city bbox. The layer URL comes
 * from the city config under the source id. A truncated answer is an error, not partial data.
 */
export async function fetchArcgisLayer<A>(sourceId: string, { city, userAgent }: FetchContext): Promise<ArcgisFeature<A>[]> {
  const layerUrl = city.sourceConfig[sourceId]?.endpoint;
  if (!layerUrl) throw new Error(`No ArcGIS layer configured for ${sourceId} in city ${city.id}`);

  return withDownloadCache(`${sourceId}-${city.id}`, async () => {
    const response = await fetch(buildLayerQuery(layerUrl, city.bbox), {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new SourceHttpError(
        `ArcGIS responded ${response.status} ${response.statusText}`,
        response.status,
        retryAfterMs(response.headers.get("Retry-After")),
      );
    }
    const body = (await response.json()) as QueryResponse<A>;
    if (body.error) throw new Error(`ArcGIS error ${body.error.code ?? ""}: ${body.error.message ?? "unknown"}`.trim());
    if (!Array.isArray(body.features)) throw new Error("ArcGIS returned no features array");
    if (body.exceededTransferLimit) throw new Error("ArcGIS truncated the answer (exceededTransferLimit)");
    return body.features;
  });
}

/** ArcGIS stores dates as epoch milliseconds. */
export function epochDate(value: unknown): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const pointOf = (feature: ArcgisFeature<unknown>) =>
  feature.geometry && Number.isFinite(feature.geometry.x) && Number.isFinite(feature.geometry.y)
    ? { x: feature.geometry.x, y: feature.geometry.y }
    : null;
