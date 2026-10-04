import { describe, expect, it } from "vitest";
import type { Route, RouteSegment } from "@krakow-bez-barier/contracts";
import { announce, earMeters, initialAnnouncer, type Announcement, type AnnouncerState } from "./announcements";
import { atStepStart, locate, type Progress } from "./navigation";

// A straight walk east along one latitude; 1 m east = this many degrees of longitude here.
const LAT = 50.06;
const DEG_PER_M = 1 / (111_320 * Math.cos((LAT * Math.PI) / 180));
const at = (meters: number, northMeters = 0): [number, number] => [19.9 + meters * DEG_PER_M, LAT + northMeters / 111_320];

/** Consecutive segments along the line, each as long as its geometry. */
function route(parts: { length: number; state: RouteSegment["state"] }[]): Route {
  let start = 0;
  const segments = parts.map(({ length, state }, i) => {
    const segment = {
      id: i + 1,
      name: null,
      instruction: `Instrukcja ${i + 1}`,
      lengthMeters: length,
      state,
      note: null,
      facts: [],
      geometry: { type: "LineString", coordinates: [at(start), at(start + length)] },
    } as unknown as RouteSegment;
    start += length;
    return segment;
  });
  return { segments, durationMinutes: 10, distanceMeters: start } as unknown as Route;
}

// 200 m met · 60 m gap (short) · 10 m met (tiny) · 150 m stairs · 100 m met to the destination: 520 m.
const walk = route([
  { length: 200, state: "met" },
  { length: 60, state: "unknown" },
  { length: 10, state: "met" },
  { length: 150, state: "barrier" },
  { length: 100, state: "met" },
]);

type Heard = Announcement & { atMeters: number };

/** Feeds positions through `locate` (as the guidance hook does) and the announcer; returns what was said, and where. */
function simulate(r: Route, positions: { meters: number; north?: number }[]) {
  let state: AnnouncerState = initialAnnouncer;
  let step = 0;
  const heard: Heard[] = [];
  for (const { meters, north } of positions) {
    const progress = locate(r, at(meters, north), step);
    step = progress.step;
    const result = announce(r, progress, state);
    state = result.state;
    if (result.announcement) heard.push({ ...result.announcement, atMeters: meters });
  }
  return heard;
}

const every = (from: number, to: number, by: number) => Array.from({ length: Math.floor((to - from) / by) + 1 }, (_, i) => ({ meters: from + i * by }));

describe("announce", () => {
  it("says each step, manoeuvre and barrier once, at the right distance, along a simulated GPS walk", () => {
    // GIVEN a walker sending a position every 5 m from the start to the destination
    // WHEN their positions go through the announcer
    const heard = simulate(walk, every(2, 520, 5));

    // THEN every message is said once, at the place it belongs
    expect(heard.map((h) => [h.atMeters, h.ids])).toEqual([
      // the first step on the first fix
      [2, ["step:0"]],
      // 50 m before the turn: the turn and the gap right after it, in one message
      [152, ["turn:1", "concern:1"]],
      // ~15 m before the turn: "now" — a short step also names its own turn and the stairs beyond the tiny step
      [187, ["step:1", "turn:2", "concern:3"]],
      // the tiny 10 m step is passed in silence; the stairs step is entered "now", with the stairs repeated
      [252, ["step:3"]],
      [372, ["turn:4"]],
      [407, ["step:4"]],
      [472, ["turn:5"]],
      [507, ["arrived"]],
    ]);
    const ids = heard.flatMap((h) => h.ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks a step reached by walking as now, and repeats the barrier of the step on entry but not a gap said ahead", () => {
    // GIVEN the same walk
    const heard = simulate(walk, every(2, 520, 5));
    const enter = (step: number) => heard.flatMap((h) => h.cues).find((c) => c.kind === "enter" && c.step === step);

    // WHEN / THEN the first step isn't "now", the next ones are
    expect(enter(0)).toEqual({ kind: "enter", step: 0, now: false, concern: false });
    // AND the gap on step 2 was said 50 m ahead, so its entry doesn't repeat it
    expect(enter(1)).toEqual({ kind: "enter", step: 1, now: true, concern: false });
    // AND the stairs are said again as the walker reaches them
    expect(enter(3)).toEqual({ kind: "enter", step: 3, now: true, concern: true });
  });

  it("says a turn once while the GPS jitters around the pre-announcement distance", () => {
    // GIVEN positions jumping back and forth around 50 m before the first turn
    const positions = [0, 148, 153, 149, 155, 151, 150].map((meters) => ({ meters }));

    // WHEN they go through the announcer
    const heard = simulate(walk, positions);

    // THEN the turn is said once
    expect(heard.flatMap((h) => h.ids).filter((id) => id === "turn:1")).toHaveLength(1);
  });

  it("says off the route once per episode, and nothing else while off it", () => {
    // GIVEN a walker who leaves the route twice, coming back in between
    const positions = [
      { meters: 20 },
      { meters: 40, north: 80 },
      { meters: 60, north: 90 },
      { meters: 80 },
      { meters: 100, north: 80 },
    ];

    // WHEN they go through the announcer
    const heard = simulate(walk, positions);

    // THEN each episode is said once, alone
    expect(heard.map((h) => h.ids)).toEqual([["step:0"], ["off:1"], ["off:2"]]);
    expect(heard[1].cues).toEqual([{ kind: "offRoute" }]);
  });

  it("never reads by itself without a position: no GPS, no announcements", () => {
    // GIVEN manual mode (no position) on every step of the route, and no progress at all
    let state = initialAnnouncer;
    const heard: Announcement[] = [];

    // WHEN the walker steps through the route by hand
    for (let step = 0; step < walk.segments.length; step++) {
      const result = announce(walk, atStepStart(walk, step), state);
      state = result.state;
      if (result.announcement) heard.push(result.announcement);
    }
    const none = announce(walk, null, initialAnnouncer);

    // THEN nothing is said automatically
    expect(heard).toEqual([]);
    expect(none.announcement).toBeNull();
  });

  it("announces the destination ahead and the arrival only once", () => {
    // GIVEN a walker standing at the destination for several fixes
    const progress: Progress = { ...locate(walk, at(520), 4) };

    // WHEN the same position arrives three times
    let state = initialAnnouncer;
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const result = announce(walk, progress, state);
      state = result.state;
      ids.push(...(result.announcement?.ids ?? []));
    }

    // THEN arrival is said once
    expect(ids).toEqual(["arrived"]);
  });
});

describe("earMeters", () => {
  it("rounds for the ear: 10 m steps near, 50 m steps farther, never below 10 m", () => {
    // GIVEN / WHEN / THEN
    expect(earMeters(3)).toBe(10);
    expect(earMeters(47)).toBe(50);
    expect(earMeters(94)).toBe(90);
    expect(earMeters(123)).toBe(120);
    expect(earMeters(257)).toBe(250);
    expect(earMeters(1234)).toBe(1200);
  });
});
