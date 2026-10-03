import type { Profile, Route, RouteRequest } from "@krakow-bez-barier/contracts";
import { defaultLocale, type Locale } from "@/i18n/locale";
import { PROFILE_PRESETS } from "@/domain/profiles";
import { createOrsProvider } from "./ors";
import { RoutingError, type LonLat, type ProviderRequest, type ProviderRoute, type RoutingProvider } from "./provider";
import { createRecordedProvider } from "./recorded-provider";
import { buildRoute, type NearbyFact, type RouteThresholds } from "./segments";

/** Facts within this distance of the route line count as on it. */
export const NEARBY_METERS = 15;

/** Our facts along a route (DB in the API, nothing in the example-data mode). */
export interface RouteFactsSource {
  factsNear(line: LonLat[], meters: number, now: Date): Promise<NearbyFact[]>;
}

/**
 * Route presets next to the place presets: kerb = the profile's max threshold. Inclines are proposals
 * (wheelchair 6% as in common ramp guidance, strollers and seniors manage a bit more); users can change both.
 */
const MAX_INCLINE_PCT: Record<Profile, number> = { wheelchair: 6, stroller: 8, senior: 8 };

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
  /** Language of the turn instructions and segment notes; default Polish. */
  locale?: Locale;
};

/** openrouteservice with `ORS_API_KEY`; without it, the recorded demo answers (Dworzec Główny → Rynek Główny). */
export function defaultProvider(): RoutingProvider {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return createRecordedProvider();
  return createOrsProvider({ apiKey, baseUrl: process.env.ORS_BASE_URL || "https://api.openrouteservice.org" });
}

/** Whether a weaker request is worth trying after `failed` ended with `error`. */
function tryNext(error: unknown, failed: ProviderRequest): boolean {
  if (!(error instanceof RoutingError)) return false;
  // The wheelchair graph is sparser: a point next to a footway can be off it while foot-walking reaches it.
  return error.kind === "no_route" || (error.kind === "point_not_routable" && failed.mode === "wheelchair");
}

const point = (p: RouteRequest["from"]): LonLat => [p.coordinates[0], p.coordinates[1]];

/**
 * Computes the requested route and judges it segment by segment (see `buildRoute`). "Avoid stairs" without a
 * profile is a walking route without steps; with a profile it is a wheelchair route within the profile's kerb and
 * incline limits. When no such route exists, the best alternative comes back (`fallback: true`) with its barriers
 * listed: with a profile the step-free walking route first, then the shortest one. Throws `RoutingError` when the
 * provider fails.
 */
export async function createRoute(request: RouteRequest, deps: RouteDeps = {}): Promise<Route> {
  const provider = deps.provider ?? defaultProvider();
  const facts = deps.facts;
  const now = deps.now ?? new Date();
  const thresholds = routeThresholds(request);
  const locale = deps.locale ?? defaultLocale;
  const ends = { from: point(request.from), to: point(request.to), locale };

  const shortest: ProviderRequest = { ...ends, mode: "foot", avoidSteps: false };
  const stepFree: ProviderRequest = { ...ends, mode: "foot", avoidSteps: true };
  const attempts: ProviderRequest[] = !request.avoidStairs
    ? [shortest]
    : thresholds
      ? [
          {
            ...ends,
            mode: "wheelchair",
            avoidSteps: true,
            restrictions: { maxKerbCm: thresholds.maxKerbCm, maxInclinePct: thresholds.maxInclinePct, smoothSurface: thresholds.smoothSurface },
          },
          stepFree,
          shortest,
        ]
      : [stepFree, shortest];

  let route: ProviderRoute | undefined;
  let used = 0;
  while (!route) {
    try {
      route = await provider.route(attempts[used]);
    } catch (error) {
      if (used === attempts.length - 1 || !tryNext(error, attempts[used])) throw error;
      used += 1;
    }
  }
  const kind: Route["kind"] = attempts[used].avoidSteps ? "avoid_stairs" : "shortest";
  const fallback = used > 0;

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
    locale,
  });
}
