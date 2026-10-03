import type { Route } from "@krakow-bez-barier/contracts";
import type { Status } from "@krakow-bez-barier/ui";
import type { Messages } from "@/i18n/messages";

type RouteMessages = Messages["route"];

export const barrierList = (route: Route) =>
  [...new Set(route.segments.filter((s) => s.state === "barrier").map((s) => s.note).filter(Boolean))].join(", ");

/** Segments without data and with conflicting data: neither counts as passable. */
export function gaps(t: RouteMessages, route: Route) {
  const conflicts = route.segments.filter((s) => s.state === "conflict").length;
  return [t.unknownOn(route.unknownSegmentCount, route.unknownMeters), conflicts ? t.conflictOn(conflicts) : null].filter(Boolean).join(", ");
}

/** One state per route, the same wherever the route is shown: barriers, then conflicts, then missing data. */
export function routeStatus(route: Route): Status {
  if (route.knownBarrierCount) return "barrier";
  if (route.segments.some((s) => s.state === "conflict")) return "conflict";
  return route.unknownSegmentCount ? "unknown" : "met";
}

/** Headline of a route without known barriers: green only when no segment lacks data. */
export const cleanHeadline = (t: RouteMessages, route: Route) =>
  route.unknownSegmentCount ? t.noKnownGaps(route.unknownMeters) : t.noKnown;
