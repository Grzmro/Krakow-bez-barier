import { describe, expect, it } from "vitest";
import { routeFailure } from "./use-route";

describe("routeFailure", () => {
  it("tells a missing routing key from a real outage and from no route", () => {
    // GIVEN the failures POST /routes can return
    // WHEN mapping them
    const reasons = {
      noRoute: routeFailure(422, { type: "https://x/problems/no-route" }).reason,
      missingKey: routeFailure(502, { type: "https://krakow-bez-barier.example/problems/routing-not-configured" }).reason,
      outage: routeFailure(502, { type: "https://krakow-bez-barier.example/problems/upstream-unavailable" }).reason,
      plain5xx: routeFailure(503, undefined).reason,
      notAProblem: routeFailure(502, undefined).reason,
    };

    // THEN only the key problem is "not_configured"; everything else that isn't a 422 keeps the retry path
    expect(reasons).toEqual({
      noRoute: "no_route",
      missingKey: "not_configured",
      outage: "unavailable",
      plain5xx: "unavailable",
      notAProblem: "unavailable",
    });
  });
});
