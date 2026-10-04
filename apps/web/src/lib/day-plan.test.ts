import { describe, expect, it } from "vitest";
import type { Route } from "@krakow-bez-barier/contracts";
import {
  addStop,
  MAX_STOPS,
  moveStop,
  parsePlan,
  removeStop,
  segmentPairs,
  segmentStatus,
  stopStatus,
  summarizePlan,
  type PlanSegment,
  type PlanStop,
} from "./day-plan";

const stop = (id: string): PlanStop => ({ id, name: id.toUpperCase() });
const route = (over: Partial<Route> = {}): Route =>
  ({
    kind: "avoid_stairs",
    durationMinutes: 10,
    distanceMeters: 800,
    segments: [],
    knownBarrierCount: 0,
    unknownSegmentCount: 0,
    unknownMeters: 0,
    fallback: false,
    ...over,
  }) as Route;

describe("segmentPairs", () => {
  it("makes n - 1 legs of consecutive stops", () => {
    // GIVEN a plan of three places
    const plan = [stop("a"), stop("b"), stop("c")];

    // WHEN the legs are composed
    const pairs = segmentPairs(plan);

    // THEN there are two, a to b and b to c
    expect(pairs.map((p) => `${p.from.id}>${p.to.id}`)).toEqual(["a>b", "b>c"]);
  });

  it("has no legs for fewer than two places", () => {
    // GIVEN / WHEN / THEN
    expect(segmentPairs([])).toEqual([]);
    expect(segmentPairs([stop("a")])).toEqual([]);
  });
});

describe("reordering", () => {
  it("moves a stop down and the legs follow the new order", () => {
    // GIVEN a plan a, b, c
    const plan = [stop("a"), stop("b"), stop("c")];

    // WHEN a moves down
    const next = moveStop(plan, 0, 1);

    // THEN the order is b, a, c and the legs are b>a, a>c
    expect(next.map((s) => s.id)).toEqual(["b", "a", "c"]);
    expect(segmentPairs(next).map((p) => `${p.from.id}>${p.to.id}`)).toEqual(["b>a", "a>c"]);
  });

  it("does not move past either end", () => {
    // GIVEN a plan of two
    const plan = [stop("a"), stop("b")];

    // WHEN the first moves up and the last moves down
    // THEN nothing changes
    expect(moveStop(plan, 0, -1)).toBe(plan);
    expect(moveStop(plan, 1, 1)).toBe(plan);
  });
});

describe("adding and removing", () => {
  it("ignores a place already in the plan", () => {
    // GIVEN a plan with a
    const plan = [stop("a")];

    // WHEN a is added again
    // THEN the plan is unchanged
    expect(addStop(plan, stop("a"))).toBe(plan);
  });

  it("stops at the maximum", () => {
    // GIVEN a full plan
    const plan = Array.from({ length: MAX_STOPS }, (_, i) => stop(`p${i}`));

    // WHEN another place is added
    // THEN it is not
    expect(addStop(plan, stop("extra"))).toBe(plan);
  });

  it("removes by id", () => {
    // GIVEN a plan a, b
    // WHEN a is removed
    // THEN b stays
    expect(removeStop([stop("a"), stop("b")], "a").map((s) => s.id)).toEqual(["b"]);
  });
});

describe("parsePlan", () => {
  it("drops malformed entries, duplicates and anything over the maximum", () => {
    // GIVEN stored JSON with junk, a duplicate and too many places
    const raw = JSON.stringify([
      { id: "a", name: "A" },
      { id: "a", name: "A again" },
      { id: 5, name: "bad" },
      null,
      ...Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
    ]);

    // WHEN it is read
    const plan = parsePlan(raw);

    // THEN only valid, unique places remain, up to the maximum
    expect(plan).toHaveLength(MAX_STOPS);
    expect(plan[0]).toEqual({ id: "a", name: "A" });
  });

  it("reads broken or missing storage as an empty plan", () => {
    // GIVEN / WHEN / THEN
    expect(parsePlan(null)).toEqual([]);
    expect(parsePlan("{not json")).toEqual([]);
    expect(parsePlan('{"id":"a"}')).toEqual([]);
  });
});

describe("summarizePlan", () => {
  const leg = (result: PlanSegment["result"]): PlanSegment => ({ from: stop("a"), to: stop("b"), result });

  it("adds time and distance of two legs and counts each leg's own status", () => {
    // GIVEN two legs, one clean and one with a known barrier
    const segments = [
      leg({ state: "route", route: route({ durationMinutes: 10, distanceMeters: 800 }) }),
      leg({ state: "route", route: route({ durationMinutes: 5, distanceMeters: 300, knownBarrierCount: 1 }) }),
    ];

    // WHEN summarized
    const summary = summarizePlan(segments);

    // THEN the plan is complete with summed totals and one met, one barrier
    expect(summary).toMatchObject({ complete: true, minutes: 15, meters: 1100 });
    expect(summary.statuses).toEqual({ met: 1, barrier: 1, conflict: 0, unknown: 0 });
  });

  it("never counts a leg with missing data as met", () => {
    // GIVEN a leg without known barriers but with a stretch without data
    const result = { state: "route", route: route({ unknownSegmentCount: 2, unknownMeters: 120 }) } as const;

    // WHEN summarized
    const summary = summarizePlan([leg(result)]);

    // THEN it counts as unknown, not met
    expect(summary.statuses).toMatchObject({ met: 0, unknown: 1 });
    expect(segmentStatus(result)).toBe("unknown");
  });

  it("stays incomplete while a leg loads or has no route, and says which", () => {
    // GIVEN one routed leg, one loading, one failed
    const segments = [
      leg({ state: "route", route: route() }),
      leg({ state: "loading" }),
      leg({ state: "error", reason: "not_configured" }),
    ];

    // WHEN summarized
    const summary = summarizePlan(segments);

    // THEN the totals are partial, flagged incomplete, and the gaps are counted
    expect(summary).toMatchObject({ complete: false, minutes: 10, loading: 1, failed: 1 });
    expect(segmentStatus({ state: "error", reason: "no_route" })).toBeNull();
  });

  it("is not complete for a plan without legs", () => {
    // GIVEN / WHEN / THEN
    expect(summarizePlan([]).complete).toBe(false);
  });
});

describe("stopStatus", () => {
  it("reads a missing verdict as no data, never met", () => {
    // GIVEN no verdict (no profile or card not loaded)
    // WHEN / THEN
    expect(stopStatus(null)).toBe("unknown");
    expect(stopStatus(undefined)).toBe("unknown");
    expect(stopStatus({ state: "barrier" })).toBe("barrier");
  });
});
