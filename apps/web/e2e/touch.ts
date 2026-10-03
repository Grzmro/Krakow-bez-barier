import type { Page } from "@playwright/test";

export type Point = { x: number; y: number };

/** Real touch input through CDP (as in map-touch.spec.ts): the browser hit-tests the finger and turns it into pointer events. */
export async function finger(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", touchPoints: Point[]) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  const STEPS = 6;
  // A real touchscreen reports a move every frame; without the gap all moves share one timestamp and have no speed.
  const frame = () => new Promise((resolve) => setTimeout(resolve, 16));
  const moveBy = async (from: Point, dy: number, dx = 0) => {
    for (let i = 1; i <= STEPS; i++) {
      await frame();
      await send("touchMove", [{ x: from.x + (dx * i) / STEPS, y: from.y + (dy * i) / STEPS }]);
    }
  };
  return {
    /** A quick swipe; `hold` keeps the finger still before lifting, so only the distance counts, not the speed. */
    async swipe(from: Point, dy: number, { hold = false, dx = 0 } = {}) {
      await send("touchStart", [from]);
      await moveBy(from, dy, dx);
      if (hold) await new Promise((resolve) => setTimeout(resolve, 250));
      await send("touchEnd", []);
    },
    async press(from: Point, dy: number) {
      await send("touchStart", [from]);
      await moveBy(from, dy);
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
