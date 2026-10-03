import { HttpError } from "../http/problem";
import type { RoutingError } from "./provider";

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
  return new HttpError(502, {
    title: "Routing provider unavailable",
    detail:
      error.kind === "not_configured"
        ? "Routing is not configured on this server."
        : "The routing provider did not answer. Try again in a moment.",
  });
}
