import { afterEach, describe, expect, it, vi } from "vitest";
import { validateResponse } from "@/server/http";
import type { FeedData, TransitFeedProvider } from "./feed";
import { createRecordedProvider } from "./recorded-provider";
import { createTransitService, transitProvider } from "./service";

afterEach(() => vi.restoreAllMocks());

const RYNEK = { lat: 50.0614, lon: 19.9373, radius: 400 };
const T0 = new Date("2026-10-03T18:10:00Z");

/** A provider that answers from the recording until `fail` is set, like the operator going down mid-session. */
function flakyProvider() {
  const recorded = createRecordedProvider();
  const state = { fail: false, calls: 0, failFeeds: [] as string[] };
  const provider: TransitFeedProvider = {
    kind: "live",
    async load(feed): Promise<FeedData> {
      state.calls++;
      if (state.fail || state.failFeeds.includes(feed.id)) throw new Error("HTTP 503");
      return recorded.load(feed);
    },
  };
  return { provider, state };
}

describe("transit departures service", () => {
  it("answers from the recording as of its own time, labelled recorded", async () => {
    // GIVEN the recorded ZTP feeds
    const service = createTransitService({ provider: createRecordedProvider(), now: () => T0 });

    // WHEN departures near the Rynek are asked for
    const result = await service.departures(RYNEK);

    // THEN stops come with upcoming departures, the source and the data's time
    expect(validateResponse("listTransitDepartures", 200, result)).toEqual([]);
    expect(result.mode).toBe("recorded");
    expect(result.source).toMatchObject({ id: "ztp-gtfs-rt", refreshStatus: "ok", license: "Do sprawdzenia" });
    expect(result.fetchedAt).toMatch(/^2026-10-03T/);
    expect(result.stops.length).toBeGreaterThan(0);
    const departures = result.stops.flatMap((s) => s.departures);
    expect(departures.length).toBeGreaterThan(0);
    // ZTP flags every tram as accessible and buses not at all: neither may come out as "accessible".
    expect(departures.filter((d) => d.mode === "tram").every((d) => d.vehicle.state === "unverified")).toBe(true);
    expect(departures.filter((d) => d.mode === "bus").every((d) => d.vehicle.state === "no_data")).toBe(true);
  });

  it("keeps serving the last data, dated, when the feed fails", async () => {
    // GIVEN a feed read once successfully
    const { provider, state } = flakyProvider();
    let now = T0;
    const service = createTransitService({ provider, now: () => now, refreshMs: 30_000 });
    const before = await service.departures(RYNEK);

    // WHEN the operator goes down and the cache has expired
    state.fail = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    now = new Date(T0.getTime() + 60_000);
    const after = await service.departures(RYNEK);

    // THEN the same stops come back, marked as an outage with the old data's time
    expect(after.source.refreshStatus).toBe("outage");
    expect(after.source.statusNote).toBeTruthy();
    expect(after.fetchedAt).toBe(before.fetchedAt);
    expect(after.source.lastSuccessAt).toBe(T0.toISOString());
    expect(after.stops.map((s) => s.name)).toEqual(before.stops.map((s) => s.name));
    expect(validateResponse("listTransitDepartures", 200, after)).toEqual([]);
  });

  it("names the failed part instead of an outage when only one feed fails", async () => {
    // GIVEN all three feeds read once, then the Mobilis bus feed (M) goes down
    const { provider, state } = flakyProvider();
    let now = T0;
    const service = createTransitService({ provider, now: () => now, refreshMs: 30_000 });
    await service.departures(RYNEK);
    state.failFeeds = ["M"];
    vi.spyOn(console, "error").mockImplementation(() => {});
    now = new Date(T0.getTime() + 60_000);

    // WHEN departures are asked for again
    const result = await service.departures(RYNEK, "en");

    // THEN the answer is not an outage, but its note names the buses, and lastSuccessAt is our last good read of M
    expect(result.source.refreshStatus).toBe("ok");
    expect(result.source.statusNote).toMatch(/buses/);
    expect(result.source.lastSuccessAt).toBe(T0.toISOString());
  });

  it("marks live data stale once the operator's feed stops updating", async () => {
    // GIVEN a live feed whose newest data is the recording's (18:16 UTC), read ten minutes later
    const { provider } = flakyProvider();
    const service = createTransitService({ provider, now: () => new Date("2026-10-03T18:27:00Z") });

    // WHEN departures are asked for
    const result = await service.departures(RYNEK);

    // THEN the answer says the data is stale, with its time
    expect(result.source.refreshStatus).toBe("stale");
    expect(result.source.statusNote).toBeTruthy();
    expect(result.fetchedAt).toMatch(/^2026-10-03T18:1/);
  });

  it("answers an outage with no stops when the feed never worked", async () => {
    // GIVEN a feed that is down from the start
    const { provider, state } = flakyProvider();
    state.fail = true;
    const service = createTransitService({ provider, now: () => T0 });

    // WHEN departures are asked for
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await service.departures(RYNEK);

    // THEN the answer is valid and says so, rather than failing the card
    expect(result).toMatchObject({ mode: "live", fetchedAt: null, stops: [] });
    expect(result.source.refreshStatus).toBe("outage");
    expect(validateResponse("listTransitDepartures", 200, result)).toEqual([]);
  });

  it("reads the feed at most once per refresh interval", async () => {
    // GIVEN a working feed of three operator files
    const { provider, state } = flakyProvider();
    let now = T0;
    const service = createTransitService({ provider, now: () => now, refreshMs: 30_000 });

    // WHEN three cards ask within 30 s, then one after
    await Promise.all([service.departures(RYNEK), service.departures(RYNEK)]);
    now = new Date(T0.getTime() + 10_000);
    await service.departures(RYNEK);
    const within = state.calls;
    now = new Date(T0.getTime() + 31_000);
    await service.departures(RYNEK);

    // THEN each feed was read once per interval
    expect(within).toBe(3);
    expect(state.calls).toBe(6);
  });

  it("simulates an outage without reading the feed", async () => {
    // GIVEN the demo switch on
    const { provider, state } = flakyProvider();
    const service = createTransitService({ provider, now: () => T0, simulateOutage: () => true });

    // WHEN departures are asked for
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await service.departures(RYNEK);

    // THEN the operator is never called and the answer is an outage
    expect(state.calls).toBe(0);
    expect(result.source.refreshStatus).toBe("outage");
  });

  it("serves nothing while the licence is unconfirmed", async () => {
    // GIVEN no provider (production without a confirmed licence)
    const service = createTransitService({ provider: null, now: () => T0 });

    // WHEN departures are asked for
    const result = await service.departures(RYNEK, "en");

    // THEN the answer says why, with no data
    expect(result).toMatchObject({ mode: "disabled", fetchedAt: null, stops: [] });
    expect(result.source).toMatchObject({ refreshStatus: "never", statusNote: expect.stringContaining("licence") });
    expect(validateResponse("listTransitDepartures", 200, result)).toEqual([]);
  });
});

describe("transitProvider", () => {
  it("never serves the feed from a production build while the licence is unconfirmed", () => {
    // GIVEN / WHEN / THEN
    expect(transitProvider({ NODE_ENV: "production", TRANSIT_FEED: "live" })).toBeNull();
    expect(transitProvider({ NODE_ENV: "production", TRANSIT_FEED: "recorded" })).toBeNull();
  });

  it("picks the provider from TRANSIT_FEED elsewhere", () => {
    // GIVEN / WHEN / THEN
    expect(transitProvider({ NODE_ENV: "development" })?.kind).toBe("live");
    expect(transitProvider({ NODE_ENV: "test", TRANSIT_FEED: "recorded" })?.kind).toBe("recorded");
    expect(transitProvider({ NODE_ENV: "development", TRANSIT_FEED: "off" })).toBeNull();
  });
});
