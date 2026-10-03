import type { RouteRequest } from "@krakow-bez-barier/contracts";
import { describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import { factRecord, placeRecord, sourceRecord } from "../places/fake-repository";
import { nearbySource, type NearbyFactRecord } from "./facts-repository";
import { RoutingError, type LonLat, type ProviderRequest, type RoutingProvider } from "./provider";
import { createRecordedProvider } from "./recorded-provider";
import { createRoute } from "./service";

const now = new Date("2026-10-03T18:00:00Z");
const recorded = createRecordedProvider();

const request = (extra: Partial<RouteRequest> = {}): RouteRequest => ({
  from: { type: "Point", coordinates: config.routeStart },
  to: { type: "Point", coordinates: config.routeEnd },
  avoidStairs: false,
  ...extra,
});

const city = sourceRecord({ id: "zdmk", name: "ZDMK: przejścia", kind: "official_open_data", baseReliability: "confirmed" });

/** A kerb fact at a point next to the route, as the PostGIS source returns it. */
function kerbAt(location: LonLat, cm: number, source = city): NearbyFactRecord {
  const place = placeRecord({ name: "Przejście", location: { x: location[0], y: location[1] } });
  return { ...factRecord(place, "kerb_height_cm", { kind: "number", number: cm, unit: "cm" }, { source, reliability: source.baseReliability }), location };
}

describe("createRoute — Dworzec Główny → Rynek Główny (recorded openrouteservice answers)", () => {
  it("shortest route: the underpass stairs are barriers and gaps in surface data are unknown", async () => {
    // GIVEN no profile
    // WHEN the shortest route is requested
    const route = await createRoute(request(), { provider: recorded, now });

    // THEN both stair segments are barriers, with OSM-via-openrouteservice facts dated by the recording
    expect(route).toMatchObject({ kind: "shortest", fallback: false, distanceMeters: 1124, durationMinutes: 13, knownBarrierCount: 2 });
    const stairs = route.segments.filter((s) => s.state === "barrier");
    expect(stairs.map((s) => [s.id, s.note])).toEqual([
      [4, "schody"],
      [6, "schody"],
    ]);
    expect(stairs[0].facts.find((f) => f.attribute === "stairs")).toMatchObject({
      value: { kind: "boolean", boolean: true },
      source: { id: "openrouteservice", kind: "community" },
      reliability: "community",
      fetchedAt: "2026-10-03T16:29:11.430Z",
    });
    // AND segments without surface data are unknown, counted with their length, never met
    expect(route.unknownSegmentCount).toBe(3);
    expect(route.unknownMeters).toBe(48);
    expect(route.segments.find((s) => s.id === 5)).toMatchObject({ state: "unknown", note: "brak danych o nawierzchni" });
  });

  it("avoid stairs without a profile: no stairs, no known barriers, unknown segments still counted", async () => {
    // GIVEN no profile
    // WHEN the avoid-stairs route is requested
    const route = await createRoute(request({ avoidStairs: true }), { provider: recorded, now });

    // THEN it is a stair-free walking route whose missing data is spelled out
    expect(route).toMatchObject({ kind: "avoid_stairs", fallback: false, knownBarrierCount: 0, unknownSegmentCount: 5, unknownMeters: 336 });
    expect(route.segments.flatMap((s) => s.facts).some((f) => f.attribute === "stairs" && f.value.kind === "boolean" && f.value.boolean)).toBe(false);
    expect(route.segments[1]).toMatchObject({ state: "unknown", note: "brak danych o nawierzchni na części odcinka", lengthMeters: 257 });
    // AND every segment's geometry is a slice of the route line
    expect(route.segments[0].geometry.coordinates[0]).toEqual(route.geometry.coordinates[0]);
  });

  it("wheelchair profile: the route stays within the profile's limits and needs incline and kerb data to pass", async () => {
    // GIVEN the wheelchair profile with its preset thresholds
    // WHEN the avoid-stairs route is requested
    const route = await createRoute(request({ avoidStairs: true, profile: "wheelchair" }), { provider: recorded, now });

    // THEN incline is judged too (an elevation-model estimate) and Floriańska, without surface data, is unknown
    expect(route).toMatchObject({ kind: "avoid_stairs", knownBarrierCount: 0 });
    // AND a segment without kerb data is unknown, never met: kerbs come only from our facts, and none are given here
    expect(route.segments[0]).toMatchObject({ state: "unknown", note: "płyty chodnikowe, płasko (do 1%), brak danych o krawężnikach" });
    expect(route.segments.every((s) => s.state === "unknown")).toBe(true);
    expect(route.unknownMeters).toBe(route.segments.reduce((sum, s) => sum + s.lengthMeters, 0));
    expect(route.segments[0].facts.find((f) => f.attribute === "incline_pct")).toMatchObject({
      value: { kind: "number", number: 1, unit: "pct" },
      reliability: "inferred",
    });
    expect(route.segments.find((s) => s.name === "Floriańska")).toMatchObject({ state: "unknown", note: "brak danych o nawierzchni" });
  });

  it("senior profile: the recorded demo route answers within the senior preset's kerb and incline limits", async () => {
    // GIVEN the senior profile with its preset thresholds
    // WHEN the avoid-stairs route is requested
    const route = await createRoute(request({ avoidStairs: true, profile: "senior" }), { provider: recorded, now });

    // THEN a wheelchair-graph route comes back without a fallback and without known barriers
    expect(route).toMatchObject({ kind: "avoid_stairs", fallback: false, knownBarrierCount: 0 });
  });

  it("in English: turn instructions and segment notes come in the requested language", async () => {
    // GIVEN the wheelchair profile and an English UI
    // WHEN the avoid-stairs route is requested in English
    const route = await createRoute(request({ avoidStairs: true, profile: "wheelchair" }), { provider: recorded, now, locale: "en" });

    // THEN the same route comes back with English instructions and notes
    expect(route).toMatchObject({ kind: "avoid_stairs", knownBarrierCount: 0 });
    expect(route.segments[0]).toMatchObject({ instruction: "Head south", state: "unknown", note: "paving slabs, flat (up to 1%), no kerb data" });
    expect(route.segments.find((s) => s.name === "Floriańska")).toMatchObject({ state: "unknown", note: "no surface data" });
  });

  it("puts our kerb facts on the nearest segment and blocks it above the profile's threshold", async () => {
    // GIVEN a confirmed 6 cm kerb at the start of the route and a 1 cm kerb further on, both from the city
    const route0 = await createRoute(request({ avoidStairs: true }), { provider: recorded, now });
    const high = kerbAt(route0.segments[0].geometry.coordinates[1] as LonLat, 6);
    const low = kerbAt(route0.segments[2].geometry.coordinates[0] as LonLat, 1);
    const facts = nearbySource(async () => [high, low]);

    // WHEN the wheelchair route is requested (max kerb 2 cm)
    const route = await createRoute(request({ avoidStairs: true, profile: "wheelchair" }), { provider: recorded, facts, now });

    // THEN the high kerb is a barrier on segment 1, with its city source, and is counted in the summary
    expect(route.segments[0]).toMatchObject({ state: "barrier", note: "krawężnik 6 cm" });
    expect(route.segments[0].facts.find((f) => f.attribute === "kerb_height_cm")).toMatchObject({
      source: { id: "zdmk", name: "ZDMK: przejścia", kind: "official_open_data" },
      reliability: "confirmed",
    });
    expect(route.knownBarrierCount).toBe(1);
    // AND without a profile the same kerb is shown but not judged
    const everyone = await createRoute(request({ avoidStairs: true }), { provider: recorded, facts, now });
    expect(everyone.segments[0].state).toBe("met");
    expect(everyone.segments[0].facts.some((f) => f.attribute === "kerb_height_cm")).toBe(true);
  });

  it("passes a segment with a profile only once a kerb within the threshold is known", async () => {
    // GIVEN a confirmed 1 cm kerb from the city on the first segment
    const route0 = await createRoute(request({ avoidStairs: true }), { provider: recorded, now });
    const facts = nearbySource(async () => [kerbAt(route0.segments[0].geometry.coordinates[1] as LonLat, 1)]);

    // WHEN the wheelchair route is requested (max kerb 2 cm)
    const route = await createRoute(request({ avoidStairs: true, profile: "wheelchair" }), { provider: recorded, facts, now });

    // THEN that segment meets the profile, while a later one without kerb data stays unknown
    expect(route.segments[0]).toMatchObject({ state: "met", note: "płyty chodnikowe, płasko (do 1%)" });
    expect(route.segments[2]).toMatchObject({ state: "unknown", note: "utwardzona, płasko (do 1%), brak danych o krawężnikach" });
  });

  it("shows sources that disagree about a kerb as a conflict, never as met", async () => {
    // GIVEN the city says 1 cm and OSM says 4 cm at the same crossing
    const route0 = await createRoute(request({ avoidStairs: true }), { provider: recorded, now });
    const at = route0.segments[0].geometry.coordinates[1] as LonLat;
    const facts = nearbySource(async () => [kerbAt(at, 1), kerbAt(at, 1.5, sourceRecord())]);

    // WHEN the route is judged without a profile
    const route = await createRoute(request({ avoidStairs: true }), { provider: recorded, facts, now });

    // THEN the segment is a conflict naming the attribute
    expect(route.segments[0]).toMatchObject({ state: "conflict", note: "sprzeczne dane: wysokość krawężnika" });
  });

  it("falls back to the shortest route with its barriers when no stair-free route exists", async () => {
    // GIVEN a provider that finds no stair-free route
    const asked: ProviderRequest[] = [];
    const provider: RoutingProvider = {
      attribution: recorded.attribution,
      async route(req) {
        asked.push(req);
        if (req.avoidSteps) throw new RoutingError("no_route", "Route could not be found");
        return recorded.route(req);
      },
    };

    // WHEN the avoid-stairs route is requested
    const route = await createRoute(request({ avoidStairs: true }), { provider, now });

    // THEN the shortest route comes back as the best alternative, with its stairs listed
    expect(asked.map((r) => r.avoidSteps)).toEqual([true, false]);
    expect(route).toMatchObject({ kind: "shortest", fallback: true, knownBarrierCount: 2 });
  });

  it("with a profile falls back to the step-free walking route before the shortest one", async () => {
    // GIVEN a provider without a wheelchair route within the profile's limits
    const asked: ProviderRequest[] = [];
    const provider: RoutingProvider = {
      attribution: recorded.attribution,
      async route(req) {
        asked.push(req);
        if (req.mode === "wheelchair") throw new RoutingError("no_route", "Route could not be found");
        return recorded.route(req);
      },
    };

    // WHEN the wheelchair avoid-stairs route is requested
    const route = await createRoute(request({ avoidStairs: true, profile: "wheelchair" }), { provider, now });

    // THEN the stair-free walking route comes back as the alternative, judged against the profile
    expect(asked.map((r) => [r.mode, r.avoidSteps])).toEqual([
      ["wheelchair", true],
      ["foot", true],
    ]);
    expect(route).toMatchObject({ kind: "avoid_stairs", fallback: true, knownBarrierCount: 0 });
  });

  it("tries the walking network when a point is off the sparser wheelchair graph", async () => {
    // GIVEN openrouteservice can't place a point on the wheelchair graph, while foot-walking can
    const asked: ProviderRequest[] = [];
    const provider: RoutingProvider = {
      attribution: recorded.attribution,
      async route(req) {
        asked.push(req);
        if (req.mode === "wheelchair") throw new RoutingError("point_not_routable", "Could not find routable point");
        return recorded.route(req);
      },
    };

    // WHEN the stroller avoid-stairs route is requested
    const route = await createRoute(request({ avoidStairs: true, profile: "stroller" }), { provider, now });

    // THEN the step-free walking route is the alternative
    expect(asked.map((r) => r.mode)).toEqual(["wheelchair", "foot"]);
    expect(route).toMatchObject({ kind: "avoid_stairs", fallback: true });
  });

  it("does not retry a point that is off the walking network too", async () => {
    // GIVEN openrouteservice can't place a point on any network
    const asked: ProviderRequest[] = [];
    const provider: RoutingProvider = {
      attribution: "",
      async route(req) {
        asked.push(req);
        throw new RoutingError("point_not_routable", "Could not find routable point");
      },
    };

    // WHEN the stair-free route is requested without a profile
    // THEN the failure reaches the caller after one call
    await expect(createRoute(request({ avoidStairs: true }), { provider, now })).rejects.toMatchObject({ kind: "point_not_routable" });
    expect(asked).toHaveLength(1);
  });

  it("passes other provider failures on", async () => {
    // GIVEN the provider is down
    const provider: RoutingProvider = {
      attribution: "",
      route: async () => {
        throw new RoutingError("unavailable", "openrouteservice answered 503");
      },
    };

    // WHEN a route is requested
    // THEN the failure reaches the caller
    await expect(createRoute(request({ avoidStairs: true }), { provider, now })).rejects.toMatchObject({ kind: "unavailable" });
  });
});
