import type { Route } from "@krakow-bez-barier/contracts";
import type { Status } from "@krakow-bez-barier/ui";
import { routeStatus } from "./route-summary";

/** A place in the day plan: its id and the name it had when added (the card behind it is loaded when the plan opens). */
export type PlanStop = { id: string; name: string };

export const MAX_STOPS = 5;

/** The plan lives only in this browser (R4, R7): no account, nothing sent anywhere but the place ids a route needs. */
export const PLAN_STORAGE_KEY = "kbb.plan.v1";

export function parsePlan(raw: string | null): PlanStop[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const stops = data.filter(
      (s): s is PlanStop => typeof s?.id === "string" && s.id !== "" && typeof s?.name === "string",
    );
    return unique(stops).slice(0, MAX_STOPS);
  } catch {
    return [];
  }
}

const unique = (stops: PlanStop[]) => stops.filter((s, i) => stops.findIndex((o) => o.id === s.id) === i);

export const isInPlan = (plan: PlanStop[], id: string) => plan.some((s) => s.id === id);

/** Adds a place at the end; a place already in the plan or a full plan leaves it as it was. */
export function addStop(plan: PlanStop[], stop: PlanStop): PlanStop[] {
  return isInPlan(plan, stop.id) || plan.length >= MAX_STOPS ? plan : [...plan, stop];
}

export const removeStop = (plan: PlanStop[], id: string): PlanStop[] => plan.filter((s) => s.id !== id);

/** Moves the stop at `index` by `delta` places (-1 up, +1 down); at an end of the list nothing moves. */
export function moveStop(plan: PlanStop[], index: number, delta: -1 | 1): PlanStop[] {
  const target = index + delta;
  if (index < 0 || index >= plan.length || target < 0 || target >= plan.length) return plan;
  const next = [...plan];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** One leg between two consecutive stops: the route, or why there is none. */
export type SegmentResult =
  | { state: "loading" }
  | { state: "route"; route: Route }
  | { state: "error"; reason: "no_route" | "not_configured" | "unavailable" };

export type PlanSegment = { from: PlanStop; to: PlanStop; result: SegmentResult };

/** Consecutive pairs of stops; a plan of n places has n - 1 legs. */
export function segmentPairs(plan: PlanStop[]): { from: PlanStop; to: PlanStop }[] {
  return plan.slice(1).map((to, i) => ({ from: plan[i], to }));
}

export type PlanSummary = {
  /** True when every leg has a route; the totals then cover the whole plan. */
  complete: boolean;
  minutes: number;
  meters: number;
  /** Legs with a route and no known barrier on it, a barrier, conflicting data, or missing data (never "met" with gaps). */
  statuses: Record<Status, number>;
  loading: number;
  failed: number;
};

/**
 * Totals over the legs that have a route. A leg without a route (still loading, none found, routing down) is counted
 * on its own and keeps the plan `incomplete`, so a partial total is never presented as the whole day.
 */
export function summarizePlan(segments: PlanSegment[]): PlanSummary {
  const summary: PlanSummary = {
    complete: segments.length > 0,
    minutes: 0,
    meters: 0,
    statuses: { met: 0, barrier: 0, conflict: 0, unknown: 0 },
    loading: 0,
    failed: 0,
  };
  for (const { result } of segments) {
    if (result.state === "route") {
      summary.minutes += result.route.durationMinutes;
      summary.meters += result.route.distanceMeters;
      summary.statuses[routeStatus(result.route)] += 1;
      continue;
    }
    summary.complete = false;
    if (result.state === "loading") summary.loading += 1;
    else summary.failed += 1;
  }
  return summary;
}

/** Status of a leg for display; a leg without a route has none and is never shown as passable. */
export const segmentStatus = (result: SegmentResult): Status | null =>
  result.state === "route" ? routeStatus(result.route) : null;

/** A stop's verdict for the profile; no card yet or no profile means no data, never a pass. */
export const stopStatus = (verdict: { state: Status } | null | undefined): Status => verdict?.state ?? "unknown";
