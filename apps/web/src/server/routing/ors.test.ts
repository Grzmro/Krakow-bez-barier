import { describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import { createOrsProvider, orsRequest } from "./ors";
import type { ProviderRequest } from "./provider";
import { DEMO_ROUTES } from "./recorded-provider";

const ends = { from: config.routeStart, to: config.routeEnd, locale: "pl" as const };

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

const provider = (fetch: typeof globalThis.fetch, apiKey: string | undefined = "test-key") =>
  createOrsProvider({ apiKey, baseUrl: "https://ors.test/", fetch });

describe("orsRequest", () => {
  it("builds exactly the requests the demo fixtures were recorded with", () => {
    // GIVEN the four requests the route screen makes for Dworzec Główny → Rynek Główny, in each language
    const requests: ProviderRequest[] = (["pl", "en"] as const).flatMap((locale) => [
      { ...ends, locale, mode: "foot", avoidSteps: false },
      { ...ends, locale, mode: "foot", avoidSteps: true },
      { ...ends, locale, mode: "wheelchair", avoidSteps: true, restrictions: { maxKerbCm: 2, maxInclinePct: 6, smoothSurface: false } },
      { ...ends, locale, mode: "wheelchair", avoidSteps: true, restrictions: { maxKerbCm: 3, maxInclinePct: 8, smoothSurface: false } },
    ]);

    // WHEN each is turned into an openrouteservice request
    const built = requests.map(orsRequest);

    // THEN each matches a recorded fixture, so the fixtures stay in step with the code
    expect(built).toEqual(DEMO_ROUTES.map((r) => r.request));
  });

  it("asks for an even surface only when the profile needs one", () => {
    // GIVEN a wheelchair request with the smooth-surface need
    const request: ProviderRequest = {
      ...ends,
      mode: "wheelchair",
      avoidSteps: true,
      restrictions: { maxKerbCm: 2, maxInclinePct: 6, smoothSurface: true },
    };

    // WHEN it is built
    const { body } = orsRequest(request);

    // THEN the surface and smoothness restrictions are set next to kerb and incline
    expect(body.options).toEqual({
      profile_params: {
        restrictions: { maximum_incline: 6, maximum_sloped_kerb: 0.02, surface_type: "paving_stones", smoothness_type: "good" },
      },
    });
  });
});

describe("createOrsProvider", () => {
  it("sends the key only in the Authorization header and reads the route", async () => {
    // GIVEN openrouteservice answering with the recorded shortest route
    const recorded = DEMO_ROUTES[0];
    const { fetch, calls } = fakeFetch(200, recorded.response);

    // WHEN a walking route is requested
    const route = await provider(fetch).route({ ...ends, mode: "foot", avoidSteps: false });

    // THEN the call goes to the foot profile with the key in the header, not in the URL or body
    expect(calls[0].url).toBe("https://ors.test/v2/directions/foot-walking/geojson");
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe("test-key");
    expect(calls[0].url).not.toContain("test-key");
    expect(String(calls[0].init.body)).not.toContain("test-key");
    // AND the route comes back with its steps and the data along it
    expect(route.distanceMeters).toBe(1124.2);
    expect(route.steps[15]).toEqual({ name: "Mały Rynek", instruction: "Skręć w prawo na Mały Rynek", distanceMeters: 7.5, from: 58, to: 60 });
    expect(route.steps[0].name).toBe("");
    expect(route.extras.waytype).toContainEqual({ from: 7, to: 8, value: 8 });
  });

  it("fails as not configured without a key and never calls the provider", async () => {
    // GIVEN no ORS_API_KEY
    const { fetch, calls } = fakeFetch(200, {});

    // WHEN a route is requested
    const result = provider(fetch, "").route({ ...ends, mode: "foot", avoidSteps: false });

    // THEN it fails as not configured
    await expect(result).rejects.toMatchObject({ kind: "not_configured" });
    expect(calls).toHaveLength(0);
  });

  it("maps openrouteservice errors: no route, point not found, outage, unreachable", async () => {
    // GIVEN the provider's error answers and a network failure
    const cases = [
      { fetch: fakeFetch(404, { error: { code: 2009, message: "Route could not be found" } }).fetch, kind: "no_route" },
      { fetch: fakeFetch(404, { error: { code: 2010, message: "Could not find routable point" } }).fetch, kind: "point_not_routable" },
      { fetch: fakeFetch(503, { error: "Service unavailable" }).fetch, kind: "unavailable" },
      { fetch: fakeFetch(200, { features: [] }).fetch, kind: "unavailable" },
      {
        fetch: (async () => {
          throw new TypeError("fetch failed");
        }) as typeof globalThis.fetch,
        kind: "unavailable",
      },
    ];

    for (const { fetch, kind } of cases) {
      // WHEN a route is requested
      const result = provider(fetch).route({ ...ends, mode: "foot", avoidSteps: true });

      // THEN the error says which failure it was
      await expect(result).rejects.toMatchObject({ name: "RoutingError", kind });
    }
  });
});
