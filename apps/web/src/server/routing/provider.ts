export type LonLat = [number, number];

/** Hard limits a wheelchair-type route must respect; the provider avoids ways that break them. */
export type RouteRestrictions = {
  maxKerbCm: number;
  maxInclinePct: number;
  smoothSurface: boolean;
};

export type ProviderRequest = {
  from: LonLat;
  to: LonLat;
  /** `foot`: pedestrian network; `wheelchair`: only ways the restrictions allow (steps never). */
  mode: "foot" | "wheelchair";
  avoidSteps: boolean;
  restrictions?: RouteRestrictions;
};

/** Range over route coordinates `[from, to]` (indexes into `coordinates`) with one data value. */
export type ExtraRange = { from: number; to: number; value: number };

export type ProviderStep = {
  name: string;
  instruction: string;
  distanceMeters: number;
  /** Indexes into `coordinates`. */
  from: number;
  to: number;
};

export type ProviderRoute = {
  /** When the provider computed it; a recorded route keeps its recording date. Defaults to now. */
  fetchedAt?: Date;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: LonLat[];
  steps: ProviderStep[];
  /** OSM-derived data along the route, as the provider reports it. Missing → no data. */
  extras: { surface: ExtraRange[]; steepness: ExtraRange[]; waytype: ExtraRange[] };
};

export type RoutingErrorKind =
  /** No API key on the server. */
  | "not_configured"
  /** Provider down, timed out, rate limited or answered something we can't read. */
  | "unavailable"
  /** No route satisfies the request (e.g. every way has steps). */
  | "no_route"
  /** A start or end point is too far from any routable way. */
  | "point_not_routable";

export class RoutingError extends Error {
  constructor(
    readonly kind: RoutingErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "RoutingError";
  }
}

/** Computes a route; openrouteservice today, any engine that reports surface, steepness and way type tomorrow. */
export interface RoutingProvider {
  /** Shown with every route, as the provider's terms require. */
  readonly attribution: string;
  route(request: ProviderRequest): Promise<ProviderRoute>;
}
