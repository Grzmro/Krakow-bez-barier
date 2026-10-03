import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "@/lib/config";
import { validateResponse } from "@/server/http";

// The handler builds the real openrouteservice provider from env; tests swap the network for recorded answers.
const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/server/routing/ors", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/routing/ors")>();
  return {
    ...original,
    createOrsProvider: (options: Parameters<typeof original.createOrsProvider>[0]) =>
      original.createOrsProvider({ ...options, fetch: fetchMock }),
  };
});

const { POST } = await import("./route");
const { DEMO_ROUTES } = await import("@/server/routing/recorded-provider");

const body = (extra: Record<string, unknown> = {}) => ({
  from: { type: "Point", coordinates: config.routeStart },
  to: { type: "Point", coordinates: config.routeEnd },
  ...extra,
});

async function post(payload: unknown) {
  const res = await POST(
    new Request("http://localhost/api/v1/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
  const json = await res.json();
  expect(validateResponse("createRoute", res.status, json)).toEqual([]);
  return { status: res.status, body: json };
}

const answer = (status: number, json: unknown) =>
  new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });

describe("POST /api/v1/routes", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
  });

  it("returns the route Dworzec Główny → Rynek with segments, barriers and gaps in data", async () => {
    // GIVEN a configured key and openrouteservice answering with the recorded shortest route, no database
    vi.stubEnv("ORS_API_KEY", "test-key");
    vi.stubEnv("DATABASE_URL", "");
    fetchMock.mockResolvedValue(answer(200, DEMO_ROUTES[0].response));

    // WHEN the shortest route is requested
    const { status, body: route } = await post(body());

    // THEN it matches the spec and lists the stairs and the segments without data
    expect(status).toBe(200);
    expect(route).toMatchObject({ kind: "shortest", fallback: false, knownBarrierCount: 2, unknownSegmentCount: 3 });
    expect(route.attribution).toBe("© OpenStreetMap contributors, openrouteservice");
  });

  it("answers 502 with a readable problem when openrouteservice is down", async () => {
    // GIVEN openrouteservice failing
    vi.stubEnv("ORS_API_KEY", "test-key");
    fetchMock.mockResolvedValue(answer(503, { error: "Service unavailable" }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    // WHEN a route is requested
    const { status, body: problem } = await post(body({ avoidStairs: true }));

    // THEN the caller gets a 502 problem without provider internals
    expect(status).toBe(502);
    expect(problem).toMatchObject({ title: "Routing provider unavailable", detail: "The routing provider did not answer. Try again in a moment." });
  });

  it("answers the demo route from recorded answers when no key is configured", async () => {
    // GIVEN no ORS_API_KEY
    vi.stubEnv("ORS_API_KEY", "");
    vi.stubEnv("DATABASE_URL", "");

    // WHEN the recorded Dworzec Główny → Rynek route is requested
    const { status, body: route } = await post(body());

    // THEN it comes from the recording, dated by it, and nothing left the server
    expect(status).toBe(200);
    expect(route).toMatchObject({ kind: "shortest", knownBarrierCount: 2 });
    expect(route.segments[0].facts[0].fetchedAt).toBe(DEMO_ROUTES[0].recordedAt);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 502 without calling openrouteservice for an unrecorded route when no key is configured", async () => {
    // GIVEN no ORS_API_KEY
    vi.stubEnv("ORS_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});

    // WHEN a route that was never recorded is requested
    const { status, body: problem } = await post({ ...body(), to: { type: "Point", coordinates: [19.94, 50.05] } });

    // THEN it is a 502 problem naming the missing configuration, and nothing left the server
    expect(status).toBe(502);
    expect(problem.type).toMatch(/\/routing-not-configured$/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 422 when a point is too far from any way", async () => {
    // GIVEN openrouteservice can't place the start on the network
    vi.stubEnv("ORS_API_KEY", "test-key");
    fetchMock.mockResolvedValue(answer(404, { error: { code: 2010, message: "Could not find routable point" } }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    // WHEN a route is requested
    const { status } = await post(body());

    // THEN it is a 422 problem
    expect(status).toBe(422);
  });

  it("answers 400 for a request that doesn't match the spec", async () => {
    // GIVEN a body without a destination
    // WHEN it is posted
    const { status, body: problem } = await post({ from: body().from });

    // THEN it is rejected before any provider call
    expect(status).toBe(400);
    expect(problem.errors[0].field).toContain("to");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
