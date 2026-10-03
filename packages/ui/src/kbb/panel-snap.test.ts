import { describe, expect, it } from "vitest";
import { releaseVelocity, snapPanel } from "./panel-snap";

const STATES = [72, 400, 780]; // bar, half, nearly full

describe("snapPanel", () => {
  it("settles a slow release on the nearest state", () => {
    // GIVEN a panel let go without speed
    // WHEN it is released near each state
    const results = [snapPanel(STATES, 150, 0), snapPanel(STATES, 520, 0.2), snapPanel(STATES, 700, -0.3)];

    // THEN each lands on the closest height
    expect(results).toEqual([0, 1, 2]);
  });

  it("moves a fast flick one state on in its direction, even after a short swipe", () => {
    // GIVEN a panel at half height, moved only a little
    // WHEN flicked up or down
    const up = snapPanel(STATES, 410, 1.2);
    const down = snapPanel(STATES, 390, -1.2);

    // THEN it goes to the next state above or below, not back to half
    expect(up).toBe(2);
    expect(down).toBe(0);
  });

  it("keeps a flick past the last state at that state", () => {
    // GIVEN a panel at the extremes
    // WHEN flicked further out
    // THEN it stays at the end state
    expect(snapPanel(STATES, 780, 2)).toBe(2);
    expect(snapPanel(STATES, 72, -2)).toBe(0);
  });

  it("works with the two states of the route screen", () => {
    // GIVEN only half and full
    // WHEN flicked up from half and released slowly near half
    // THEN it opens fully, then stays at half
    expect(snapPanel([400, 780], 420, 1)).toBe(1);
    expect(snapPanel([400, 780], 500, 0)).toBe(0);
  });
});

describe("releaseVelocity", () => {
  it("measures the speed of the last 100 ms, rising finger positive", () => {
    // GIVEN a finger moving up 100 px in the last 50 ms after a long still hold
    const samples = [
      { t: 0, y: 500 },
      { t: 400, y: 500 },
      { t: 450, y: 450 },
      { t: 500, y: 400 },
    ];
    // WHEN the speed is measured
    // THEN only the recent movement counts
    expect(releaseVelocity(samples)).toBeCloseTo(1);
  });

  it("is zero for a finger held still before release or a single sample", () => {
    // GIVEN a finger that stopped moving / a lone sample
    // WHEN measured
    // THEN no speed
    expect(releaseVelocity([{ t: 0, y: 300 }, { t: 300, y: 300 }])).toBe(0);
    expect(releaseVelocity([{ t: 0, y: 300 }])).toBe(0);
    expect(releaseVelocity([])).toBe(0);
  });
});
