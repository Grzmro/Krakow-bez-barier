import { describe, expect, it } from "vitest";
import { routingHttpError, ROUTING_NOT_CONFIGURED } from "./errors";
import { RoutingError } from "./provider";

describe("routingHttpError", () => {
  it("names a missing ORS key with its own problem type, apart from an outage", () => {
    // GIVEN the two ways routing can be unavailable
    // WHEN mapping them to problems
    const missing = routingHttpError(new RoutingError("not_configured", "ORS_API_KEY is not set"));
    const down = routingHttpError(new RoutingError("unavailable", "openrouteservice answered 503"));

    // THEN both are 502, but only the missing key carries the type clients branch on
    expect(missing.problem.status).toBe(502);
    expect(missing.problem.type).toBe(ROUTING_NOT_CONFIGURED);
    expect(down.problem.status).toBe(502);
    expect(down.problem.type).not.toBe(ROUTING_NOT_CONFIGURED);
  });

  it("keeps provider details out of the response", () => {
    // GIVEN a provider message with internals WHEN mapping THEN the detail stays generic
    const problem = routingHttpError(new RoutingError("unavailable", "key=SECRET host=internal")).problem;
    expect(problem.detail).not.toMatch(/SECRET|internal/);
  });
});
