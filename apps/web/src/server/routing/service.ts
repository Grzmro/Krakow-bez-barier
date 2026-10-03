import type { Profile, Route, RouteRequest } from "@krakow-bez-barier/contracts";
import { PROFILE_PRESETS } from "../domain/profiles";
import { createOrsProvider } from "./ors";
import { RoutingError, type LonLat, type ProviderRequest, type RoutingProvider } from "./provider";
import { buildRoute, type NearbyFact, type RouteThresholds } from "./segments";

/** Facts within this distance of the route line count as on it. */
export const NEARBY_METERS = 15;

/** Our facts along a route (DB in the API, nothing in the example-data mode). */
export interface RouteFactsSource {
  factsNear(line: LonLat[], meters: number, now: Date): Promise<NearbyFact[]>;
}

/**
 * Route presets next to the place presets: kerb = the profile's max threshold. Inclines are proposals
 * (wheelchair 6% as in common ramp guidance, strollers manage a bit more); users can change both.
 */
const MAX_INCLINE_PCT: Record<Profile, number> = { wheelchair: 6, stroller: 8 };

export function routeThresholds(request: RouteRequest): RouteThresholds | null {
  if (!request.profile) return null;
  const preset = PROFILE_PRESETS[request.profile];
  return {
    maxKerbCm: request.maxThresholdCm ?? preset.maxThresholdCm,
    maxInclinePct: request.maxInclinePct ?? MAX_INCLINE_PCT[request.profile],
    smoothSurface: request.requireSmoothSurface ?? preset.requireSmoothSurface,
  };
}

export type RouteDeps = {
  provider?: RoutingProvider;
  /** Omitted: only the provider's data. */
  facts?: RouteFactsSource;
  now?: Date;
};

function defaultProvider(): RoutingProvider {
  return createOrsProvider({
    apiKey: process.env.ORS_API_KEY,
    baseUrl: process.env.ORS_BASE_URL || "https://api.openrouteservice.org",
  });
}

const point = (p: RouteRequest["from"]): LonLat => [p.coordinates[0], p.coordinates[1]];

/**
 * Computes the requested route and judges it segment by segment (see `buildRoute`). "Avoid stairs" without a
 * profile is a walking route without steps; with a profile it is a wheelchair route within the profile's kerb and
 * incline limits. When no such route exists, the shortest route comes back as the best alternative
 * (`fallback: true`) with its barriers listed. Throws `RoutingError` when the provider fails.
 */
export async function createRoute(request: RouteRequest, deps: RouteDeps = {}): Promise<Route> {
  const provider = deps.provider ?? defaultProvider();
  const facts = deps.facts;
  const now = deps.now ?? new Date();
  const thresholds = routeThresholds(request);
  const ends = { from: point(request.from), to: point(request.to) };

  const shortest: ProviderRequest = { ...ends, mode: "foot", avoidSteps: false };
  const wanted: ProviderRequest = !request.avoidStairs
    ? shortest
    : thresholds
      ? {
          ...ends,
          mode: "wheelchair",
          avoidSteps: true,
          restrictions: { maxKerbCm: thresholds.maxKerbCm, maxInclinePct: thresholds.maxInclinePct, smoothSurface: thresholds.smoothSurface },
        }
      : { ...ends, mode: "foot", avoidSteps: true };

  let kind: Route["kind"] = request.avoidStairs ? "avoid_stairs" : "shortest";
  let fallback = false;
  let route;
  try {
    route = await provider.route(wanted);
  } catch (error) {
    if (!(error instanceof RoutingError && error.kind === "no_route" && wanted !== shortest)) throw error;
    route = await provider.route(shortest);
    kind = "shortest";
    fallback = true;
  }

  const nearby = facts ? await facts.factsNear(route.coordinates, NEARBY_METERS, now) : [];
  return buildRoute({
    route,
    kind,
    fallback,
    thresholds,
    nearby,
    attribution: provider.attribution,
    fetchedAt: route.fetchedAt ?? now,
    now,
  });
}
