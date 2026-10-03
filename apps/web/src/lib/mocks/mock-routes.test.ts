import { describe, expect, it } from "vitest";
import { withRealRoutes } from "./mock-routes";

const mock = async () => new Response("mock", { status: 299 });
const real = async () => new Response("real", { status: 200 });

describe("withRealRoutes", () => {
  it("sends POST /routes to the real API", async () => {
    // GIVEN the example-data client
    const fetch = withRealRoutes(mock, real);

    // WHEN a route is requested
    const res = await fetch(new Request("http://localhost/api/v1/routes", { method: "POST", body: "{}" }));

    // THEN it went to the real endpoint
    expect(await res.text()).toBe("real");
  });

  it("sends GET /transit/departures to the real API", async () => {
    // GIVEN the example-data client
    const fetch = withRealRoutes(mock, real);

    // WHEN departures are requested
    const res = await fetch(new Request("http://localhost/api/v1/transit/departures?lat=50.06&lon=19.94"));

    // THEN it went to the real endpoint
    expect(await res.text()).toBe("real");
  });

  it("leaves every other call to the mocks", async () => {
    // GIVEN the example-data client
    const fetch = withRealRoutes(mock, real);

    // WHEN places are listed
    const res = await fetch(new Request("http://localhost/api/v1/places"));

    // THEN the mock answers
    expect(res.status).toBe(299);
  });
});
