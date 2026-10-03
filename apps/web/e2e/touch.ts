import type { Page } from "@playwright/test";

export type Point = { x: number; y: number };
type TouchPoint = Point & { id?: number };

/**
 * Real touch input through CDP: the browser hit-tests every finger like on a phone and turns it into pointer events,
 * so the page's and MapLibre's touch handlers see exactly what a user's finger would give them.
 */
export async function finger(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", touchPoints: TouchPoint[]) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  const STEPS = 6;
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  /** Moves the fingers to `at(t)` for t from 1/STEPS to 1. */
  const move = async (at: (t: number) => TouchPoint[]) => {
    for (let i = 1; i <= STEPS; i++) {
      // A real touchscreen reports a move every frame; without the gap all moves share one timestamp and have no speed.
      await wait(16);
      await send("touchMove", at(i / STEPS));
    }
  };
  const line = (from: Point, dx: number, dy: number) => (t: number) => [{ x: from.x + dx * t, y: from.y + dy * t }];
  const swipe = async (from: Point, dy: number, { hold = false, dx = 0 } = {}) => {
    await send("touchStart", [from]);
    await move(line(from, dx, dy));
    if (hold) await wait(250);
    await send("touchEnd", []);
  };
  return {
    /** A quick swipe; `hold` keeps the finger still before lifting, so only the distance counts, not the speed. */
    swipe,
    /** A deliberate pan: the finger holds still before lifting, so MapLibre skips its inertia and the map settles at once. */
    drag: (from: Point, delta: Point) => swipe(from, delta.y, { dx: delta.x, hold: true }),
    /** Two fingers on a horizontal line through `center`, moving from `fromGap` to `toGap` apart. */
    async pinch(center: Point, fromGap: number, toGap: number) {
      const fingers = (gap: number) => [
        { x: center.x - gap / 2, y: center.y, id: 0 },
        { x: center.x + gap / 2, y: center.y, id: 1 },
      ];
      await send("touchStart", fingers(fromGap));
      await move((t) => fingers(fromGap + (toGap - fromGap) * t));
      await send("touchEnd", []);
    },
    /** Puts a finger down and moves it, without lifting. */
    async press(from: Point, dy: number) {
      await send("touchStart", [from]);
      await move(line(from, 0, dy));
    },
    async lift() {
      await send("touchEnd", []);
    },
    async tap(at: Point) {
      await send("touchStart", [at]);
      await send("touchEnd", []);
    },
  };
}
