import { startParam, type RouteStart } from "./route-start";
import { routes } from "./routes";

/** Marks a link someone shared on purpose: the landing explains that the result follows the recipient's own profile. */
export const SHARED_PARAM = "share";

/**
 * A position (this device, a map point) is personal; the station and a place id are not.
 * Only a personal start needs the sender's explicit "Dołącz mój start".
 */
export const isPersonalStart = (start: RouteStart) => start.kind === "me" || start.kind === "point";

function withShared(path: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${SHARED_PARAM}=1`;
}

/** The permanent card link for a recipient. The needs profile is never part of it. */
export function placeShareLink(origin: string, placeId: string): string {
  return new URL(withShared(routes.place(placeId)), origin).toString();
}

/**
 * The route link for a recipient: the destination (`?do=`), the start (`?z=`) only when it isn't personal or the sender
 * opted in (a position is rounded to ~100 m by `startParam`), never the needs profile. Without a start the recipient's
 * own position, or a start they choose, is used.
 */
export function routeShareLink(origin: string, link: { to?: string; start: RouteStart; includeStart: boolean }): string {
  const from = isPersonalStart(link.start) && !link.includeStart ? undefined : startParam(link.start);
  return new URL(withShared(routes.route(link.to, from)), origin).toString();
}

/** Whether a page was opened from a shared link (`?share=1`). */
export function isSharedLink(value: string | string[] | undefined): boolean {
  return value === "1";
}
