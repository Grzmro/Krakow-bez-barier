import { HttpError } from "../http/problem";
import type { RoutingError } from "./provider";

/** Problem `type` clients use to tell a missing ORS key from a provider outage. */
export const ROUTING_NOT_CONFIGURED = "https://krakow-bez-barier.example/problems/routing-not-configured";

/**
 * The documented problem for a routing failure: 422 when no route exists between the points, 502 when the provider
 * is missing or down. Details stay generic — provider messages are logged, not returned.
 */
export function routingHttpError(error: RoutingError): HttpError {
  if (error.kind === "no_route" || error.kind === "point_not_routable") {
    return new HttpError(422, {
      type: "https://krakow-bez-barier.example/problems/no-route",
      title: "No route",
      detail:
        error.kind === "no_route"
          ? "No walkable route connects these points."
          : "The start or the destination is too far from any walkable way.",
    });
  }
  if (error.kind === "not_configured") {
    return new HttpError(502, {
      type: ROUTING_NOT_CONFIGURED,
      title: "Routing not configured",
      detail: "Routing is not configured on this server: only the recorded demo route has an answer.",
    });
  }
  return new HttpError(502, {
    title: "Routing provider unavailable",
    detail: "The routing provider did not answer. Try again in a moment.",
  });
}
