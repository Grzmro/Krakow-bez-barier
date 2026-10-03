import { afterEach, describe, expect, it, vi } from "vitest";
import { validateResponse } from "@/server/http";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// The service is a per-server singleton that reads TRANSIT_FEED on first use, so each test imports a fresh route.
async function get(url: string, env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const { GET } = await import("./route");
  return GET(new Request(url));
}

describe("GET /api/v1/transit/departures", () => {
  it("lists departures near a point from the recorded feed", async () => {
    // GIVEN the recorded ZTP feeds
    // WHEN departures near the Rynek are requested
    const res = await get("http://localhost/api/v1/transit/departures?lat=50.0614&lon=19.9373", { TRANSIT_FEED: "recorded" });

    // THEN a valid, uncached answer with stops comes back
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(validateResponse("listTransitDepartures", 200, body)).toEqual([]);
    expect(body.mode).toBe("recorded");
    expect(body.stops.length).toBeGreaterThan(0);
  });

  it("rejects a point outside WGS84 and a radius over the limit", async () => {
    // GIVEN / WHEN invalid query values
    const badLat = await get("http://localhost/api/v1/transit/departures?lat=95&lon=19.9", { TRANSIT_FEED: "recorded" });
    const badRadius = await get("http://localhost/api/v1/transit/departures?lat=50&lon=19.9&radius=5000", {
      TRANSIT_FEED: "recorded",
    });

    // THEN both are documented 400 problems
    expect(badLat.status).toBe(400);
    expect(badRadius.status).toBe(400);
    expect(validateResponse("listTransitDepartures", 400, await badLat.json())).toEqual([]);
  });

  it("answers disabled when the feed is switched off", async () => {
    // GIVEN TRANSIT_FEED=off
    // WHEN departures are requested
    const res = await get("http://localhost/api/v1/transit/departures?lat=50.0614&lon=19.9373", { TRANSIT_FEED: "off" });

    // THEN the answer is valid and empty, with the reason
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ mode: "disabled", stops: [] });
  });
});
