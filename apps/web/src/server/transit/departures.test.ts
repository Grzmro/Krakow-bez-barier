import { describe, expect, it } from "vitest";
import { nearbyDepartures, vehicleAccessibility } from "./departures";
import { fleetEntriesFor, type FleetEntry } from "./fleet";
import { ZTP_FEEDS, type FeedData } from "./feed";

const [TRAM, BUS] = ZTP_FEEDS;
const NOW = 1_791_050_800;
const RYNEK: [number, number] = [19.9373, 50.0614];

const tram: FeedData = {
  feed: TRAM,
  timestamp: NOW - 20,
  stops: [
    { id: "t1", name: "Teatr Bagatela", platform: "01", lat: 50.0636, lon: 19.9333 },
    { id: "t2", name: "Teatr Bagatela", platform: "02", lat: 50.0637, lon: 19.9331 },
    { id: "t9", name: "Daleko", platform: "01", lat: 50.09, lon: 19.99 },
  ],
  routes: { r8: "8" },
  trips: { a: ["r8", "Borek Fałęcki"], b: ["r8", "Bronowice"] },
  tripUpdates: [
    {
      trip: { tripId: "a" },
      vehicle: { id: "405", label: "405", wheelchair: 2 },
      stopTimes: [
        { stopId: "t1", departure: NOW - 120, scheduleRelationship: 0 },
        { stopId: "t2", departure: NOW + 300, scheduleRelationship: 0 },
        { stopId: "t9", arrival: NOW + 900, scheduleRelationship: 0 },
      ],
    },
    {
      trip: { tripId: "b" },
      stopTimes: [
        { stopId: "t1", departure: NOW + 120, delaySeconds: 60, scheduleRelationship: 0 },
        { stopId: "t9", departure: NOW + 200, scheduleRelationship: 1 },
        { stopId: "t2", arrival: NOW + 600, scheduleRelationship: 0 },
      ],
    },
  ],
  vehicles: [{ trip: { tripId: "b" }, timestamp: NOW - 5, vehicle: { label: "2001", wheelchair: 3 } }],
};

const bus: FeedData = {
  feed: BUS,
  timestamp: NOW - 10,
  stops: [{ id: "b1", name: "Teatr Bagatela", platform: "03", lat: 50.0635, lon: 19.9335 }],
  routes: {},
  trips: {},
  tripUpdates: [
    {
      trip: { tripId: "c", routeId: "502" },
      stopTimes: [
        { stopId: "b1", departure: NOW + 3000, scheduleRelationship: 0 },
        { stopId: "x", departure: NOW + 4000, scheduleRelationship: 0 },
      ],
    },
    {
      trip: { tripId: "d", routeId: "179" },
      stopTimes: [
        { stopId: "b1", departure: NOW + 3700, scheduleRelationship: 0 },
        { stopId: "x", departure: NOW + 3800, scheduleRelationship: 0 },
      ],
    },
  ],
  vehicles: [{ trip: { tripId: "c" }, timestamp: NOW - 30, vehicle: { label: "147" } }],
};

describe("vehicleAccessibility", () => {
  it.each([
    [BUS, 2, "accessible", "confirmed"],
    [BUS, 3, "inaccessible", "confirmed"],
    [TRAM, 2, "unverified", "inferred"],
    [TRAM, 3, "inaccessible", "confirmed"],
    [BUS, 1, "no_data", null],
    [BUS, 0, "no_data", null],
    [TRAM, undefined, "no_data", null],
  ] as const)("%o flag %s → %s", (feed, wheelchair, state, reliability) => {
    // GIVEN a vehicle with the operator's wheelchair flag
    const vehicle = { label: "1", wheelchair };

    // WHEN it is mapped
    const result = vehicleAccessibility(feed, vehicle, NOW);

    // THEN only a trusted flag says accessible; nothing else ever does
    expect(result).toMatchObject({ state, reliability });
  });

  it("says no data when the trip has no vehicle at all", () => {
    // GIVEN / WHEN no vehicle
    const result = vehicleAccessibility(BUS, undefined, undefined);

    // THEN
    expect(result).toEqual({ state: "no_data", reliability: null, label: null, observedAt: null, evidence: [] });
  });
});

describe("vehicleAccessibility with fleet types", () => {
  const source = { name: "Test fleet list", license: "CC0", licenseConfirmed: true };
  const entry = (lowFloor: boolean, kind: "fleet_type" | "carrier_declaration" = "fleet_type"): FleetEntry => ({
    feedId: "A",
    labels: ["1"],
    model: kind === "fleet_type" ? "Solaris Urbino 12" : "niskopodłogowe od 2019",
    lowFloor,
    kind,
    source,
  });

  it("agrees: the flag and the fleet type say the same, so the fact has both sources", () => {
    // GIVEN a bus flagged accessible whose model is low-floor
    // WHEN it is mapped
    const result = vehicleAccessibility(BUS, { label: "1", wheelchair: 2 }, NOW, [entry(true)]);

    // THEN it is accessible with two pieces of evidence
    expect(result.state).toBe("accessible");
    expect(result.evidence.map((e) => e.kind)).toEqual(["operator_flag", "fleet_type"]);
  });

  it("conflicts: a flag against the fleet type shows both values and never picks one", () => {
    // GIVEN a bus flagged inaccessible whose model is low-floor
    // WHEN it is mapped
    const result = vehicleAccessibility(BUS, { label: "1", wheelchair: 3 }, NOW, [entry(true)]);

    // THEN it is a conflict carrying both statements
    expect(result.state).toBe("conflict");
    expect(result.evidence.map((e) => [e.kind, e.accessible])).toEqual([
      ["operator_flag", false],
      ["fleet_type", true],
    ]);
  });

  it("does not let a default tram flag conflict with, or confirm, the fleet type", () => {
    // GIVEN a tram flagged accessible (a default for trams) whose model is high-floor
    // WHEN it is mapped
    const result = vehicleAccessibility(TRAM, { label: "1", wheelchair: 2 }, NOW, [{ ...entry(false), feedId: "T" }]);

    // THEN only the fleet type speaks
    expect(result.state).toBe("inaccessible");
    expect(result.evidence.map((e) => e.kind)).toEqual(["fleet_type"]);
  });

  it("is not accessible without a flag or a fleet type", () => {
    // GIVEN / WHEN a vehicle with no flag and no fleet entry
    const result = vehicleAccessibility(BUS, { label: "1", wheelchair: 1 }, NOW, []);

    // THEN no data
    expect(result).toMatchObject({ state: "no_data", evidence: [] });
  });

  it("keeps a carrier declaration alone as a declaration, ranked below a fleet type", () => {
    // GIVEN a vehicle with no flag and only the carrier saying it is low-floor
    // WHEN it is mapped
    const declared = vehicleAccessibility(BUS, { label: "1" }, NOW, [entry(true, "carrier_declaration")]);
    const typed = vehicleAccessibility(BUS, { label: "1" }, NOW, [entry(true)]);

    // THEN it is "declared" with lower reliability, not a vehicle check
    expect(declared).toMatchObject({ state: "declared", reliability: "inferred" });
    expect(typed).toMatchObject({ state: "accessible", reliability: "extracted" });
  });

  it("conflicts when the declaration disagrees with the operator's flag", () => {
    // GIVEN a bus the operator flags inaccessible that the carrier declares low-floor
    // WHEN it is mapped
    const result = vehicleAccessibility(BUS, { label: "1", wheelchair: 3 }, NOW, [entry(true, "carrier_declaration")]);

    // THEN both are shown
    expect(result.state).toBe("conflict");
    expect(result.evidence).toHaveLength(2);
  });
});

describe("fleetEntriesFor", () => {
  const source = (licenseConfirmed: boolean) => ({ name: "List", license: "?", licenseConfirmed });
  const fleet: FleetEntry[] = [
    { feedId: "A", labels: { from: 100, to: 199 }, model: "X", lowFloor: true, kind: "fleet_type", source: source(false) },
    { feedId: "A", labels: ["7"], model: "Y", lowFloor: true, kind: "fleet_type", source: source(true) },
  ];

  it("matches by feed and fleet number, in ranges and lists", () => {
    // GIVEN / WHEN / THEN
    expect(fleetEntriesFor(fleet, "A", "147", { production: false }).map((e) => e.model)).toEqual(["X"]);
    expect(fleetEntriesFor(fleet, "A", "7", { production: false }).map((e) => e.model)).toEqual(["Y"]);
    expect(fleetEntriesFor(fleet, "M", "147", { production: false })).toEqual([]);
    expect(fleetEntriesFor(fleet, "A", undefined, { production: false })).toEqual([]);
  });

  it("drops entries of a source with an unconfirmed licence in production", () => {
    // GIVEN / WHEN / THEN
    expect(fleetEntriesFor(fleet, "A", "147", { production: true })).toEqual([]);
    expect(fleetEntriesFor(fleet, "A", "7", { production: true })).toHaveLength(1);
  });
});

describe("nearbyDepartures", () => {
  it("groups platforms by stop name and lists upcoming departures from both feeds", () => {
    // GIVEN tram and bus platforms of one stop near the Rynek and one far away
    // WHEN departures within 500 m are asked for
    const stops = nearbyDepartures([tram, bus], RYNEK, NOW, { radiusMeters: 500 });

    // THEN one stop comes back with its departures in time order
    expect(stops).toHaveLength(1);
    expect(stops[0]).toMatchObject({ id: "A:b1", name: "Teatr Bagatela" });
    expect(stops[0].departures.map((d) => [d.line, d.platform, d.headsign, d.vehicle.state])).toEqual([
      ["8", "01", "Bronowice", "inaccessible"],
      ["8", "02", "Borek Fałęcki", "unverified"],
      ["502", "03", null, "no_data"],
    ]);
  });

  it("leaves out past, skipped, too-late departures and arrivals at the last stop", () => {
    // GIVEN the far stop, where trip a ends, b skips and both run within the hour
    // WHEN departures there are asked for
    const [far] = nearbyDepartures([tram], [19.99, 50.09], NOW, { radiusMeters: 100 });

    // THEN nothing departs from it: a ends there, b skips it
    expect(far.name).toBe("Daleko");
    expect(far.departures).toEqual([]);

    // AND bus d, due in more than an hour, is not listed
    const [near] = nearbyDepartures([bus], RYNEK, NOW, { radiusMeters: 500 });
    expect(near.departures.map((d) => d.tripId)).toEqual(["c"]);
  });

  it("dates each vehicle by its last position and carries the delay", () => {
    // GIVEN / WHEN
    const [stop] = nearbyDepartures([tram], RYNEK, NOW, { radiusMeters: 500 });

    // THEN the trip with a vehicle position is dated by it, the other by the feed
    const b = stop.departures.find((d) => d.tripId === "b")!;
    const a = stop.departures.find((d) => d.tripId === "a")!;
    expect(b).toMatchObject({ delaySeconds: 60, departureAt: new Date((NOW + 120) * 1000).toISOString() });
    expect(b.vehicle.observedAt).toBe(new Date((NOW - 5) * 1000).toISOString());
    expect(a.vehicle.observedAt).toBe(new Date((NOW - 20) * 1000).toISOString());
  });

  it("leaves out a trip the timetable doesn't know", () => {
    // GIVEN a realtime trip missing from trips.txt and without a route id
    const unknownTrip: FeedData = {
      ...tram,
      tripUpdates: [
        {
          trip: { tripId: "not-in-timetable" },
          stopTimes: [
            { stopId: "t1", departure: NOW + 60, scheduleRelationship: 0 },
            { stopId: "t9", arrival: NOW + 600, scheduleRelationship: 0 },
          ],
        },
      ],
    };

    // WHEN / THEN it has no line to show, so it is not listed
    const [stop] = nearbyDepartures([unknownTrip], RYNEK, NOW, { radiusMeters: 500 });
    expect(stop.departures).toEqual([]);
  });

  it("returns no stops outside the radius", () => {
    // GIVEN / WHEN a point far from every stop
    const stops = nearbyDepartures([tram, bus], [19.8, 50.0], NOW, { radiusMeters: 400 });

    // THEN
    expect(stops).toEqual([]);
  });
});
