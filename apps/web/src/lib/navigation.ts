import type { Route, RouteSegment } from "@krakow-bez-barier/contracts";

/** Closer than this to the end of a step: the next one starts. */
export const ARRIVE_METERS = 15;
/** Farther than this from the route: off the route (GPS in a city is often 10–20 m off). */
export const OFF_ROUTE_METERS = 40;

const EARTH_RADIUS_M = 6_371_000;
const RAD = Math.PI / 180;

/** Where the walker is on the route: the step, what's left of it and of the route, and how far off they are. */
export type Progress = {
  step: number;
  /** Metres to the end of the current step. */
  toStepEnd: number;
  remainingMeters: number;
  remainingMinutes: number;
  /** Metres from the nearest point of the route; `null` without a position (manual mode). */
  offBy: number | null;
  offRoute: boolean;
  arrived: boolean;
};

type Projection = { distance: number; along: number; length: number };

/** Nearest point of a line to `point` (both `[lon, lat]`), in metres: distance to it and along the line. Flat-earth maths, fine within a city. */
export function project(line: number[][], point: number[]): Projection {
  const cos = Math.cos(point[1] * RAD);
  const xy = ([lon, lat]: number[]) => [lon * RAD * EARTH_RADIUS_M * cos, lat * RAD * EARTH_RADIUS_M];
  const [px, py] = xy(point);
  let best = { distance: Infinity, along: 0 };
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = xy(line[i - 1]);
    const [bx, by] = xy(line[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const span = Math.hypot(dx, dy);
    const t = span ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / span ** 2)) : 0;
    const distance = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (distance < best.distance) best = { distance, along: walked + t * span };
    walked += span;
  }
  if (line.length === 1) {
    const [ax, ay] = xy(line[0]);
    best = { distance: Math.hypot(px - ax, py - ay), along: 0 };
  }
  return { ...best, length: walked };
}

const totalMeters = (route: Route) => route.segments.reduce((sum, s) => sum + s.lengthMeters, 0);

function progressAt(route: Route, step: number, toStepEnd: number, offBy: number | null): Progress {
  const after = route.segments.slice(step + 1).reduce((sum, s) => sum + s.lengthMeters, 0);
  const remainingMeters = Math.max(0, toStepEnd + after);
  const total = totalMeters(route);
  const last = step === route.segments.length - 1;
  const offRoute = offBy !== null && offBy > OFF_ROUTE_METERS;
  return {
    step,
    toStepEnd: Math.max(0, toStepEnd),
    remainingMeters,
    remainingMinutes: total ? Math.ceil((route.durationMinutes * remainingMeters) / total) : 0,
    offBy,
    offRoute,
    arrived: last && !offRoute && offBy !== null && toStepEnd <= ARRIVE_METERS,
  };
}

/** Progress without a position (manual mode): the walker is at the start of `step`. */
export function atStepStart(route: Route, step: number): Progress {
  return progressAt(route, step, route.segments[step]?.lengthMeters ?? 0, null);
}

/**
 * Progress from a device position (`[lon, lat]`). Off the route is measured against the whole route, but only steps
 * from `from` on are matched, so a route that passes the same street twice never sends the walker back. Near the end
 * of a step the next one starts; off the route, or back on an earlier step, the step stays.
 */
export function locate(route: Route, position: number[], from: number): Progress {
  const segments = route.segments;
  const projections = segments.map((segment) => project(segment.geometry.coordinates, position));
  const offBy = Math.min(...projections.map((p) => p.distance));
  let index = from;
  for (let i = from + 1; i < segments.length; i++) if (projections[i].distance < projections[index].distance) index = i;
  const projection = projections[index];
  if (!projection || projection.distance > OFF_ROUTE_METERS) return progressAt(route, from, segments[from]?.lengthMeters ?? 0, offBy);
  // Geometry and the provider's lengths differ a little; the provider's length is what the list shows.
  const share = projection.length ? 1 - projection.along / projection.length : 0;
  const toStepEnd = segments[index].lengthMeters * share;
  if (toStepEnd <= ARRIVE_METERS && index < segments.length - 1) return progressAt(route, index + 1, segments[index + 1].lengthMeters, offBy);
  return progressAt(route, index, toStepEnd, offBy);
}

/** A segment the walker should know about: a barrier, conflicting data or no data. */
export type Concern = { segment: RouteSegment; index: number; inMeters: number };

/** The current step's own concern, and the next one ahead with the distance to its start. */
export function concerns(route: Route, progress: Pick<Progress, "step" | "toStepEnd">): { here: Concern | null; ahead: Concern | null } {
  const segments = route.segments;
  const current = segments[progress.step];
  const here = current && current.state !== "met" ? { segment: current, index: progress.step, inMeters: 0 } : null;
  let inMeters = progress.toStepEnd;
  for (let i = progress.step + 1; i < segments.length; i++) {
    if (segments[i].state !== "met") return { here, ahead: { segment: segments[i], index: i, inMeters } };
    inMeters += segments[i].lengthMeters;
  }
  return { here, ahead: null };
}

/** The sources behind a segment's facts, each with its latest fetch date (ISO), in the order they first appear. */
export function provenance(segment: RouteSegment): { name: string; fetchedAt: string }[] {
  const latest = new Map<string, string>();
  for (const fact of segment.facts) {
    const seen = latest.get(fact.source.name);
    if (!seen || fact.fetchedAt > seen) latest.set(fact.source.name, fact.fetchedAt);
  }
  return [...latest].map(([name, fetchedAt]) => ({ name, fetchedAt }));
}
