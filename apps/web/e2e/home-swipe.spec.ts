import { devices, type Locator, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";

type Point = { x: number; y: number };

// Real touch input through CDP (as in map-touch.spec.ts): the browser hit-tests the finger and turns it into pointer events.
async function finger(page: Page) {
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

const panel = (page: Page) => page.getByRole("region", { name: "Lista miejsc" });

/** A point on the panel's top row (grabber row or stowed bar), clear of the buttons on the right and of the dev-tools badge in the bottom-left corner. */
async function topRow(page: Page): Promise<Point> {
  const row = panel(page).locator("> div").first();
  const box = (await row.boundingBox())!;
  return { x: box.x + box.width * 0.3, y: box.y + Math.min(20, box.height / 2) };
}

async function centre(locator: Locator): Promise<Point> {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The panel height once its height transition is over. */
async function settledHeight(page: Page) {
  await expect.poll(() => panel(page).evaluate((el) => el.getAnimations().length), { timeout: 10_000 }).toBe(0);
  return (await panel(page).boundingBox())!.height;
}

/** How far the document is scrolled: a swipe must move the panel, never the page under it. */
const pageScroll = (page: Page) => page.evaluate(() => document.scrollingElement!.scrollTop);

async function openHome(page: Page) {
  await page.goto("/");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  await expect(panel(page)).toHaveAttribute("data-expanded", "false");
  return settledHeight(page);
}

for (const [name, device] of [
  ["Pixel 7", devices["Pixel 7"]],
  ["iPhone 15", devices["iPhone 15"]],
] as const) {
  test.describe(`list panel swipe on ${name}`, () => {
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = device;
    test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
    // Every touch step waits for a rendered frame of the software-GL map (as in map-touch.spec.ts).
    test.describe.configure({ timeout: 30_000 });
    const slug = name.replace(" ", "-").toLowerCase();

    test("swiping the grabber down stows the panel to the bar", async ({
      page,
      expectAccessible,
      evidence,
    }) => {
      // GIVEN the home screen with the list at half height
      const half = await openHome(page);
      const touch = await finger(page);

      // WHEN a finger swipes the grabber down most of the way to the bottom
      // (far enough that speed and distance agree, so machine load can't decide the state; flicks are unit-tested)
      const grabber = await centre(panel(page).getByRole("button", { name: "Rozwiń arkusz" }));
      await touch.swipe(grabber, Math.min(0.8 * half, page.viewportSize()!.height - grabber.y - 4));

      // THEN only the bar is left, its "show" button is focused and says it's collapsed, and the page didn't scroll
      expect(await pageScroll(page)).toBe(0);
      const show = panel(page).getByRole("button", { name: "Pokaż listę" });
      await expect(panel(page)).toHaveAttribute("data-stowed", "true");
      await expect(show).toHaveAttribute("aria-expanded", "false");
      await expect(show).toBeFocused();
      const bar = await settledHeight(page);
      expect(bar).toBeLessThan(half / 2);
      await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-swipe-stowed.aria.yml" });
      await expectAccessible();
      await evidence(`home-swipe-stowed-${slug}`);
    });

    test("swiping the bar up brings the list back at half height, then nearly full", async ({ page, expectAccessible, evidence }) => {
      // GIVEN the list stowed to the bar earlier in this session
      await page.addInitScript(() => sessionStorage.setItem("kbb-list-stowed", "1"));
      await page.goto("/");
      await expect(panel(page)).toHaveAttribute("data-stowed", "true");
      const bar = await settledHeight(page);
      const half = (await page.locator("main").boundingBox())!.height / 2;
      const touch = await finger(page);

      // WHEN a finger swipes the bar up, most of the way to half height
      await touch.swipe(await topRow(page), -0.8 * (half - bar));

      // THEN the list is back at half height, with the grabber still offering to expand, and the page didn't scroll
      await expect(panel(page)).toHaveAttribute("data-stowed", "false");
      expect(await pageScroll(page)).toBe(0);
      await expect(panel(page).getByRole("button", { name: "Rozwiń arkusz" })).toHaveAttribute("aria-expanded", "false");
      await expect(panel(page).getByRole("button", { name: "Schowaj listę" })).toBeFocused();
      const halfHeight = await settledHeight(page);
      expect(halfHeight).toBeGreaterThan(bar * 2);

      // WHEN it swipes up once more, close to the top
      const top = await topRow(page);
      await touch.swipe(top, -(top.y - 140));

      // THEN the panel nearly fills the screen and the grabber says it's expanded
      await expect(panel(page)).toHaveAttribute("data-expanded", "true");
      await expect(panel(page).getByRole("button", { name: "Zwiń arkusz" })).toHaveAttribute("aria-expanded", "true");
      expect(await settledHeight(page)).toBeGreaterThan(halfHeight * 1.5);
      await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-swipe-expanded.aria.yml" });
      await expectAccessible();
      await evidence(`home-swipe-expanded-${slug}`);

      // AND the buttons still work after a swipe
      await panel(page).getByRole("button", { name: "Zwiń arkusz" }).press("Enter");
      await expect(panel(page)).toHaveAttribute("data-expanded", "false");
    });

    test("the arrow keys on the grabber step between the states", async ({ page }) => {
      // GIVEN the list at half height, the grabber focused
      await openHome(page);
      await panel(page).getByRole("button", { name: "Rozwiń arkusz" }).focus();

      // WHEN ArrowUp is pressed
      await page.keyboard.press("ArrowUp");

      // THEN the panel is expanded and the grabber keeps focus
      await expect(panel(page)).toHaveAttribute("data-expanded", "true");
      await expect(panel(page).getByRole("button", { name: "Zwiń arkusz" })).toBeFocused();

      // WHEN ArrowDown is pressed twice
      await page.keyboard.press("ArrowDown");
      await expect(panel(page)).toHaveAttribute("data-expanded", "false");
      await page.keyboard.press("ArrowDown");

      // THEN only the bar is left, with its "show" button focused
      await expect(panel(page)).toHaveAttribute("data-stowed", "true");
      const show = panel(page).getByRole("button", { name: "Pokaż listę" });
      await expect(show).toBeFocused();

      // WHEN ArrowUp is pressed on it
      await page.keyboard.press("ArrowUp");

      // THEN the list is back at half height
      await expect(panel(page)).toHaveAttribute("data-stowed", "false");
      await expect(panel(page)).toHaveAttribute("data-expanded", "false");
    });

    test("the list shows while the bar is pulled up, but stays inert until release", async ({ page }) => {
      // GIVEN the list stowed to the bar
      await page.addInitScript(() => sessionStorage.setItem("kbb-list-stowed", "1"));
      await page.goto("/");
      await expect(panel(page)).toHaveAttribute("data-stowed", "true");
      await settledHeight(page);
      const touch = await finger(page);
      const scroller = panel(page).locator("> [role=group]");

      // WHEN a finger pulls the bar up without lifting
      await touch.press(await topRow(page), -150);

      // THEN the list is already visible under the bar, yet still hidden from assistive tech
      await expect(scroller).toBeVisible();
      expect((await scroller.boundingBox())!.height).toBeGreaterThan(40);
      await expect(scroller).toHaveAttribute("aria-hidden", "true");

      // AND after the finger lifts the list is a normal part of the page again
      await touch.lift();
      await expect(panel(page)).toHaveAttribute("data-stowed", "false");
      await expect(scroller).not.toHaveAttribute("aria-hidden");
    });

    test("a slow drag settles on the nearest height; a short one springs back", async ({ page }) => {
      // GIVEN the list at half height
      const half = await openHome(page);
      const touch = await finger(page);

      // WHEN a finger drags the top row a little and holds still before lifting
      await touch.swipe(await topRow(page), -40, { hold: true });

      // THEN the panel stays at half
      expect(Math.abs((await settledHeight(page)) - half)).toBeLessThan(2);
      await expect(panel(page)).toHaveAttribute("data-expanded", "false");

      // WHEN it drags most of the way up and holds
      const top = await topRow(page);
      await touch.swipe(top, -(top.y - 120), { hold: true });

      // THEN the panel lands nearly full
      await expect(panel(page)).toHaveAttribute("data-expanded", "true");
      await expect(panel(page)).toHaveAttribute("data-stowed", "false");
    });

    test("the panel follows the finger while it moves", async ({ page }) => {
      // GIVEN the list at half height
      const half = await openHome(page);
      const touch = await finger(page);

      // WHEN a finger drags the top row up without lifting
      await touch.press(await topRow(page), -60);

      // THEN the panel is already taller, and settles back once the finger lifts
      expect((await panel(page).boundingBox())!.height).toBeGreaterThan(half + 40);
      await touch.lift();
      await expect(panel(page)).toHaveAttribute("data-expanded", "false");
      expect(Math.abs((await settledHeight(page)) - half)).toBeLessThan(2);
    });

    test("with reduced motion the panel only jumps, it doesn't follow the finger", async ({ page }) => {
      // GIVEN a visitor who asked for less motion
      await page.emulateMedia({ reducedMotion: "reduce" });
      const half = await openHome(page);
      const touch = await finger(page);

      // WHEN a finger drags the top row most of the way up without lifting
      const top = await topRow(page);
      await touch.press(top, -(top.y - 120));

      // THEN the panel keeps its height until the finger lifts, then jumps to the nearest state
      expect(Math.abs((await panel(page).boundingBox())!.height - half)).toBeLessThan(2);
      await touch.lift();
      await expect(panel(page)).toHaveAttribute("data-expanded", "true");
    });

    test("the home screen fits the screen, so nothing but the list and the panel moves", async ({ page }) => {
      // GIVEN the home screen at phone size
      await openHome(page);

      // THEN the document is no taller than the viewport and can't be scrolled
      const { scrollHeight, innerHeight } = await page.evaluate(() => ({
        scrollHeight: document.scrollingElement!.scrollHeight,
        innerHeight: window.innerHeight,
      }));
      expect(scrollHeight).toBeLessThanOrEqual(innerHeight);
      expect(await pageScroll(page)).toBe(0);
    });

    test("a drag on the list resizes the panel when the list can't scroll that way, and scrolls it otherwise", async ({ page }) => {
      // GIVEN the list at half height, scrolled to its top
      const half = await openHome(page);
      const touch = await finger(page);
      const scroller = page.getByRole("group", { name: "Lista miejsc" });
      const scrollTop = () => scroller.evaluate((el) => el.scrollTop);
      const inList = async (from: "top" | "bottom") => {
        const box = (await scroller.boundingBox())!;
        const bottom = Math.min(box.y + box.height, page.viewportSize()!.height);
        return { x: box.x + box.width / 2, y: from === "top" ? box.y + 40 : bottom - 40 };
      };

      // WHEN a finger drags up inside the list, most of the way to the top, and holds before lifting
      // (distance, not speed, decides, so machine load can't; flicks are unit-tested)
      const low = await inList("bottom");
      await touch.swipe(low, -(low.y - 140), { hold: true });

      // THEN the panel expands instead of the list scrolling, and the page stays put
      await expect(panel(page)).toHaveAttribute("data-expanded", "true");
      const full = await settledHeight(page);
      expect(await scrollTop()).toBe(0);
      expect(await pageScroll(page)).toBe(0);

      // WHEN it flicks up once more, now that the panel is fully expanded
      await touch.swipe(await inList("bottom"), -150);

      // THEN the list scrolls and the panel stays expanded
      await expect.poll(scrollTop).toBeGreaterThan(50);
      await expect(panel(page)).toHaveAttribute("data-expanded", "true");

      // WHEN it flicks down while the list is scrolled
      let listScroll = -1;
      await expect.poll(async () => listScroll === (listScroll = await scrollTop())).toBe(true);
      await touch.swipe(await inList("top"), 60);

      // THEN the list scrolls back towards its top and the panel keeps its height
      await expect.poll(scrollTop).toBeLessThan(listScroll);
      await expect(panel(page)).toHaveAttribute("data-expanded", "true");

      // WHEN it drags down most of the way to half height with the list back at its top
      // (once the fling has stopped: Chrome doesn't let a page cancel a touch that lands mid-fling)
      await expect.poll(async () => listScroll === (listScroll = await scrollTop())).toBe(true);
      await scroller.evaluate((el) => el.scrollTo({ top: 0, behavior: "instant" }));
      await expect.poll(scrollTop).toBe(0);
      await touch.swipe(await inList("top"), 0.8 * (full - half), { hold: true });

      // THEN the panel collapses to half height, without the page moving
      await expect(panel(page)).toHaveAttribute("data-expanded", "false");
      await expect(panel(page)).toHaveAttribute("data-stowed", "false");
      expect(await pageScroll(page)).toBe(0);
    });

    test("a sideways swipe on the filters scrolls them; tapping the grabber still toggles", async ({ page }) => {
      // GIVEN the list at half height
      await openHome(page);
      const touch = await finger(page);
      const filters = panel(page).getByRole("group", { name: "Filtry cech" });
      await filters.scrollIntoViewIfNeeded();

      // WHEN a finger swipes the feature filters sideways
      await touch.swipe(await centre(filters), 0, { dx: -150 });

      // THEN they scroll and the panel keeps its height
      await expect.poll(() => filters.evaluate((el) => el.scrollLeft)).toBeGreaterThan(50);
      await expect(panel(page)).toHaveAttribute("data-expanded", "false");
      await expect(panel(page)).toHaveAttribute("data-stowed", "false");

      // WHEN the grabber is tapped
      await touch.tap(await centre(panel(page).getByRole("button", { name: "Rozwiń arkusz" })));

      // THEN it toggles as before
      await expect(panel(page)).toHaveAttribute("data-expanded", "true");
    });
  });
}
