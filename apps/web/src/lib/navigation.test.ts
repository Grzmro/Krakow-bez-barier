import { describe, expect, it } from "vitest";
import type { AccessibilityFact, Route, RouteSegment } from "@krakow-bez-barier/contracts";
import { atStepStart, concerns, locate, project, provenance } from "./navigation";

const LAT = 50.06;
// 0.001° of longitude at Kraków's latitude ≈ 71.5 m.
const STEP_DEG = 0.001;

function segment(id: number, state: RouteSegment["state"], facts: AccessibilityFact[] = []): RouteSegment {
  const start = 19.94 + (id - 1) * STEP_DEG;
  return {
    id,
    name: `Ulica ${id}`,
    instruction: `Krok ${id}`,
    lengthMeters: 70,
    state,
    note: state === "met" ? null : "schody",
    facts,
    geometry: { type: "LineString", coordinates: [[start, LAT], [start + STEP_DEG, LAT]] },
  };
}

function fact(source: string, fetchedAt: string, extra: Partial<AccessibilityFact> = {}): AccessibilityFact {
  return {
    id: `${source}-${fetchedAt}`,
    attribute: "step_count",
    value: 3,
    source: { id: source, name: source, kind: "community" },
    fetchedAt,
    reliability: "community",
    status: "active",
    stale: false,
    ...extra,
  } as unknown as AccessibilityFact;
}

function route(segments: RouteSegment[]): Route {
  return {
    kind: "avoid_stairs",
    fallback: false,
    durationMinutes: 6,
    distanceMeters: 210,
    geometry: { type: "LineString", coordinates: segments.flatMap((s) => s.geometry.coordinates) },
    segments,
    knownBarrierCount: 0,
    unknownSegmentCount: 0,
    unknownMeters: 0,
  } as unknown as Route;
}

const walk = route([segment(1, "met"), segment(2, "met"), segment(3, "barrier", [fact("OpenStreetMap", "2025-09-01T10:00:00Z")])]);

describe("project", () => {
  it("measures the distance to a line and how far along it the nearest point is", () => {
    // GIVEN a point 0.0005° east of a line's start and ~22 m north of it
    const line = [[19.94, LAT], [19.941, LAT]];

    // WHEN it is projected
    const result = project(line, [19.9405, LAT + 0.0002]);

    // THEN it is half way along and about 22 m off
    expect(result.along / result.length).toBeCloseTo(0.5, 2);
    expect(result.distance).toBeGreaterThan(20);
    expect(result.distance).toBeLessThan(24);
  });
});

describe("locate", () => {
  it("finds the step and what is left of it and of the route", () => {
    // GIVEN a walker a quarter into the second step
    // WHEN they are located
    const progress = locate(walk, [19.941 + STEP_DEG / 4, LAT], 0);

    // THEN they are on step 2 with ~52 m of it and ~122 m of the route left, on the route
    expect(progress.step).toBe(1);
    expect(progress.toStepEnd).toBeCloseTo(52.5, 0);
    expect(progress.remainingMeters).toBeCloseTo(122.5, 0);
    expect(progress.remainingMinutes).toBe(4);
    expect(progress.offRoute).toBe(false);
  });

  it("starts the next step close to the end of the current one", () => {
    // GIVEN a walker 5 m before the end of step 1
    // WHEN they are located
    const progress = locate(walk, [19.941 - STEP_DEG * (5 / 70), LAT], 0);

    // THEN step 2 is current, with all of it ahead
    expect(progress.step).toBe(1);
    expect(progress.toStepEnd).toBe(70);
  });

  it("never sends the walker back to an earlier step", () => {
    // GIVEN a walker already on step 3 who is located on step 1's geometry
    // WHEN they are located from step 3 on
    const progress = locate(walk, [19.9405, LAT], 2);

    // THEN step 3 stays, and they are still on the route
    expect(progress.step).toBe(2);
    expect(progress.offRoute).toBe(false);
  });

  it("reports a walker ~80 m from the route as off it and keeps the step", () => {
    // GIVEN a walker on step 2 who wandered ~80 m north
    // WHEN they are located
    const progress = locate(walk, [19.9415, LAT + 0.00072], 1);

    // THEN they are off the route by more than 40 m, still on step 2
    expect(progress.offRoute).toBe(true);
    expect(progress.offBy).toBeGreaterThan(75);
    expect(progress.step).toBe(1);
  });

  it("says the walker arrived at the end of the last step", () => {
    // GIVEN a walker at the end of the route
    // WHEN they are located
    const progress = locate(walk, [19.943, LAT], 2);

    // THEN they arrived
    expect(progress).toMatchObject({ step: 2, arrived: true, offRoute: false });
  });
});

describe("atStepStart", () => {
  it("counts the whole step and the rest of the route without a position", () => {
    // GIVEN / WHEN manual mode on step 2
    const progress = atStepStart(walk, 1);

    // THEN all of step 2 and step 3 are ahead, and nothing is said about the route distance
    expect(progress).toMatchObject({ step: 1, toStepEnd: 70, remainingMeters: 140, offBy: null, offRoute: false, arrived: false });
  });
});

describe("concerns", () => {
  it("names the next segment that is not a pass, with the distance to it", () => {
    // GIVEN a walker with 30 m of step 1 left and stairs on step 3
    // WHEN the concerns are listed
    const { here, ahead } = concerns(walk, { step: 0, toStepEnd: 30 });

    // THEN nothing is wrong here and the stairs are 100 m ahead
    expect(here).toBeNull();
    expect(ahead).toMatchObject({ index: 2, inMeters: 100 });
  });

  it("names the current segment when it is the barrier", () => {
    // GIVEN / WHEN the walker is on the barrier step
    const { here, ahead } = concerns(walk, { step: 2, toStepEnd: 70 });

    // THEN it is the concern here and none follows
    expect(here?.index).toBe(2);
    expect(ahead).toBeNull();
  });
});

describe("provenance", () => {
  it("lists each source once with its latest fetch date", () => {
    // GIVEN a segment with two OSM facts and one MSIP fact
    const s = segment(1, "barrier", [fact("OpenStreetMap", "2025-08-01T00:00:00Z"), fact("MSIP", "2024-01-01T00:00:00Z"), fact("OpenStreetMap", "2025-09-01T00:00:00Z")]);

    // WHEN its provenance is listed
    // THEN OSM appears once with September, MSIP with its own date
    expect(provenance(s)).toEqual([
      { name: "OpenStreetMap", fetchedAt: "2025-09-01T00:00:00Z", reliability: "community", stale: false },
      { name: "MSIP", fetchedAt: "2024-01-01T00:00:00Z", reliability: "community", stale: false },
    ]);
  });

  it("keeps the reliability and staleness of each source's latest fact, so sample data stays labelled", () => {
    // GIVEN an older community fact and a newer sample fact from one source, and a stale fact from another
    const s = segment(2, "barrier", [
      fact("OpenStreetMap", "2025-08-01T00:00:00Z"),
      fact("OpenStreetMap", "2025-09-01T00:00:00Z", { reliability: "sample" }),
      fact("MSIP", "2024-01-01T00:00:00Z", { reliability: "confirmed", stale: true }),
    ]);

    // WHEN its provenance is listed
    // THEN each source carries the reliability and staleness of its latest fact
    expect(provenance(s)).toEqual([
      { name: "OpenStreetMap", fetchedAt: "2025-09-01T00:00:00Z", reliability: "sample", stale: false },
      { name: "MSIP", fetchedAt: "2024-01-01T00:00:00Z", reliability: "confirmed", stale: true },
    ]);
  });
});
