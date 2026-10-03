import {
  RoutingError,
  type ExtraRange,
  type LonLat,
  type ProviderRequest,
  type ProviderRoute,
  type RoutingProvider,
} from "./provider";

/** What we send to openrouteservice for one route — the key travels only in the Authorization header. */
export type OrsRequest = { profile: "foot-walking" | "wheelchair"; body: Record<string, unknown> };

export const ORS_ATTRIBUTION = "© OpenStreetMap contributors, openrouteservice";

const EXTRAS = ["surface", "steepness", "waytype"] as const;

// ORS error codes (directions v2): 2009 route not found, 2010 point not found, 2004 limits exceeded.
const NO_ROUTE = 2009;
const POINT_NOT_FOUND = 2010;

export function orsRequest({ from, to, mode, avoidSteps, restrictions, locale }: ProviderRequest): OrsRequest {
  const options: Record<string, unknown> = {};
  // The wheelchair profile never routes over steps; only the foot profile needs telling.
  if (avoidSteps && mode === "foot") options.avoid_features = ["steps"];
  if (mode === "wheelchair" && restrictions) {
    options.profile_params = {
      restrictions: {
        maximum_incline: restrictions.maxInclinePct,
        maximum_sloped_kerb: restrictions.maxKerbCm / 100,
        ...(restrictions.smoothSurface && { surface_type: "paving_stones", smoothness_type: "good" }),
      },
    };
  }
  return {
    profile: mode === "wheelchair" ? "wheelchair" : "foot-walking",
    body: {
      coordinates: [from, to],
      extra_info: [...EXTRAS],
      instructions: true,
      language: locale,
      units: "m",
      ...(Object.keys(options).length > 0 && { options }),
    },
  };
}

type OrsStep = { distance: number; instruction: string; name: string; way_points: [number, number] };
type OrsExtra = { values: [number, number, number][] };
type OrsFeature = {
  geometry: { coordinates: number[][] };
  properties: {
    summary?: { distance?: number; duration?: number };
    segments?: { steps?: OrsStep[] }[];
    extras?: Partial<Record<(typeof EXTRAS)[number], OrsExtra>>;
  };
};

const ranges = (extra: OrsExtra | undefined): ExtraRange[] =>
  (extra?.values ?? []).map(([from, to, value]) => ({ from, to, value }));

/** Reads an ORS GeoJSON directions response; throws `unavailable` when it isn't one. */
export function parseOrsResponse(json: unknown): ProviderRoute {
  const feature = (json as { features?: OrsFeature[] } | null)?.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!feature || !Array.isArray(coordinates) || coordinates.length < 2) {
    throw new RoutingError("unavailable", "openrouteservice answered without a route geometry");
  }
  const { summary, segments = [], extras = {} } = feature.properties ?? {};
  // Multi-leg routes only happen with waypoints; we send two points, so legs are concatenated as-is.
  const steps = segments.flatMap((leg) => leg.steps ?? []);
  return {
    distanceMeters: summary?.distance ?? 0,
    durationSeconds: summary?.duration ?? 0,
    coordinates: coordinates.map(([lon, lat]) => [lon, lat] as LonLat),
    steps: steps.map((step) => ({
      name: step.name && step.name !== "-" ? step.name : "",
      instruction: step.instruction,
      distanceMeters: step.distance,
      from: step.way_points[0],
      to: step.way_points[1],
    })),
    extras: { surface: ranges(extras.surface), steepness: ranges(extras.steepness), waytype: ranges(extras.waytype) },
  };
}

export function errorFor(status: number, json: unknown): RoutingError {
  const error = (json as { error?: { code?: number; message?: string } } | null)?.error;
  if (status === 404 && error?.code === NO_ROUTE) return new RoutingError("no_route", error.message ?? "no route");
  if (status === 404 && error?.code === POINT_NOT_FOUND) {
    return new RoutingError("point_not_routable", error.message ?? "point not routable");
  }
  return new RoutingError("unavailable", `openrouteservice answered ${status}${error?.message ? `: ${error.message}` : ""}`);
}

export type OrsOptions = {
  apiKey: string | undefined;
  baseUrl: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

export function createOrsProvider({ apiKey, baseUrl, timeoutMs = 10_000, fetch: doFetch = fetch }: OrsOptions): RoutingProvider {
  return {
    attribution: ORS_ATTRIBUTION,
    async route(request) {
      if (!apiKey) throw new RoutingError("not_configured", "ORS_API_KEY is not set");
      const { profile, body } = orsRequest(request);
      let response: Response;
      try {
        response = await doFetch(`${baseUrl.replace(/\/$/, "")}/v2/directions/${profile}/geojson`, {
          method: "POST",
          headers: { authorization: apiKey, "content-type": "application/json", accept: "application/geo+json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw new RoutingError("unavailable", `openrouteservice unreachable: ${(error as Error).message}`);
      }
      const json: unknown = await response.json().catch(() => null);
      if (!response.ok) throw errorFor(response.status, json);
      return parseOrsResponse(json);
    },
  };
}
