import { devices, type CDPSession, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { expandClusters, pins } from "./map";

type Point = { x: number; y: number };

// Real touch input through CDP, so the browser hit-tests every finger like on a phone and MapLibre's
// touch handlers see exactly what a user's finger would give them.
async function touchscreen(page: Page) {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", touchPoints: (Point & { id?: number })[]) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  const STEPS = 4;
  return {
    async drag(from: Point, delta: Point) {
      await send("touchStart", [from]);
      for (let i = 1; i <= STEPS; i++) {
        await send("touchMove", [{ x: from.x + (delta.x * i) / STEPS, y: from.y + (delta.y * i) / STEPS }]);
      }
      // Hold still before lifting, like a deliberate pan: MapLibre then skips its inertia and the map settles at once.
      await new Promise((resolve) => setTimeout(resolve, 200));
      await send("touchEnd", []);
    },
    async pinch(center: Point, fromGap: number, toGap: number) {
      const fingers = (gap: number) => [
        { x: center.x - gap / 2, y: center.y, id: 0 },
        { x: center.x + gap / 2, y: center.y, id: 1 },
      ];
      await send("touchStart", fingers(fromGap));
      for (let i = 1; i <= STEPS; i++) await send("touchMove", fingers(fromGap + ((toGap - fromGap) * i) / STEPS));
      await send("touchEnd", []);
    },
    async tap(at: Point) {
      await send("touchStart", [at]);
      await send("touchEnd", []);
    },
  };
}


/** Screen position of two pins: their midpoint follows a pan, their gap follows the zoom. */
async function view(page: Page) {
  const [a, b] = await pins(page).evaluateAll((els) =>
    [els[0], els.at(-1)!].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }),
  );
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, gap: Math.hypot(a.x - b.x, a.y - b.y) };
}

// Waits out MapLibre's ease/inertia so the next gesture is measured from a still map.
async function settledView(page: Page) {
  let last = await view(page);
  await page.waitForTimeout(120);
  await expect
    .poll(
      async () => {
        const next = await view(page);
        const still = Math.abs(next.x - last.x) < 0.5 && Math.abs(next.y - last.y) < 0.5 && Math.abs(next.gap - last.gap) < 0.5;
        last = next;
        return still;
      },
      { message: "map keeps moving", intervals: [120] },
    )
    .toBe(true);
  return last;
}

/** Where a finger lands on plain map: below the chips, above the attribution and the panel, left of the zoom buttons. */
async function freeMapArea(page: Page) {
  const box = async (selector: Parameters<Page["locator"]>[0]) => (await page.locator(selector).first().boundingBox())!;
  const chips = await box('[aria-label="Kategorie"]');
  const zoom = (await page.getByRole("button", { name: "Przybliż" }).boundingBox())!;
  const attribution = await box("main p:has(> span > a[href*='openstreetmap'])");
  const panel = (await page.getByRole("region", { name: "Lista miejsc" }).boundingBox())!;
  return {
    left: 16,
    right: zoom.x - 8,
    top: chips.y + chips.height + 8,
    bottom: Math.min(attribution.y, panel.y) - 8,
  };
}

async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Lista miejsc" }).getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  // Zoomed out, the sample pins merge into clusters; one level past the split keeps them apart during a pinch.
  await expandClusters(page);
  expect(await pins(page).count()).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Przybliż" }).click();
  await settledView(page);
}

for (const [name, device] of [
  ["Pixel 7", devices["Pixel 7"]],
  ["iPhone 15", devices["iPhone 15"]],
] as const) {
  test.describe(`map touch gestures on ${name}`, () => {
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = device;
    test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
    // Every touch step waits for a rendered frame of the software-GL map; ten drags take ~7 s alone.
    test.describe.configure({ timeout: 30_000 });

    test("ten drags anywhere on the visible map each pan it, also after the sheet is toggled", async ({ page, evidence }) => {
      // GIVEN the home screen zoomed in to single sample pins
      await openHome(page);
      const touch = await touchscreen(page);
      const area = await freeMapArea(page);
      const sheetToggle = page.getByRole("region", { name: "Lista miejsc" }).getByRole("button", { name: "Rozwiń arkusz", expanded: false });

      for (let i = 0; i < 10; i++) {
        if (i === 5) {
          // AND halfway the visitor expands and collapses the sheet
          await sheetToggle.click();
          await page.getByRole("button", { name: "Zwiń arkusz" }).click();
          await expect(sheetToggle).toBeVisible();
          await settledView(page);
        }
        // WHEN a finger drags from a different spot of the map each time, back and forth
        const from = {
          x: area.left + ((i % 5) / 4) * (area.right - area.left),
          y: area.top + (i % 2 ? 0.85 : 0.15 + (i % 3) * 0.3) * (area.bottom - area.top),
        };
        const delta = { x: i % 2 ? -50 : 50, y: i % 4 < 2 ? 30 : -30 };
        const before = await view(page);
        await touch.drag(from, delta);
        const after = await settledView(page);

        // THEN the map follows the finger
        expect(Math.hypot(after.x - before.x, after.y - before.y), `drag ${i + 1} from ${from.x},${from.y}`).toBeGreaterThan(30);
      }
      await evidence(`map-touch-${name.replace(" ", "-").toLowerCase()}`);
    });

    test("a two-finger pinch zooms the map in and out", async ({ page }) => {
      // GIVEN the home screen
      await openHome(page);
      const touch = await touchscreen(page);
      const area = await freeMapArea(page);
      // Low on the map, beside the zoom buttons and attribution: both fingers must get past their container.
      const center = { x: (area.left + area.right) / 2, y: area.top + 0.8 * (area.bottom - area.top) };
      const start = await view(page);

      // WHEN two fingers spread apart
      await touch.pinch(center, 60, 180);
      const zoomedIn = await settledView(page);

      // THEN the pins move apart; pinching back brings them closer again
      expect(zoomedIn.gap).toBeGreaterThan(start.gap * 1.5);
      await touch.pinch(center, 180, 60);
      expect((await settledView(page)).gap).toBeLessThan(zoomedIn.gap / 1.5);
    });

    test("scrolling the sheet's list leaves the map alone, and dragging the map leaves the list alone", async ({ page }) => {
      // GIVEN the home screen with the list scrolled down a little (a swipe up at half height would expand the sheet instead)
      await openHome(page);
      const touch = await touchscreen(page);
      const scroller = page.getByRole("group", { name: "Lista miejsc" });
      const list = (await scroller.boundingBox())!;
      const scrollTop = () => scroller.evaluate((el) => el.scrollTop);
      await scroller.evaluate((el) => (el.scrollTop = 300));
      const scrolled = await scrollTop();
      expect(scrolled).toBeGreaterThan(100);
      const before = await view(page);

      // WHEN a finger swipes down inside the visible part of the list
      await touch.drag({ x: list.x + list.width / 2, y: list.y + 20 }, { x: 0, y: 150 });

      // THEN the list scrolls back up, the sheet keeps its height and the map does not move
      await expect.poll(scrollTop).toBeLessThan(scrolled - 50);
      await expect(page.getByRole("region", { name: "Lista miejsc" })).toHaveAttribute("data-stowed", "false");
      const afterList = await settledView(page);
      expect(Math.hypot(afterList.x - before.x, afterList.y - before.y)).toBeLessThan(1);

      // WHEN a finger drags the map, once the list's fling has stopped
      let listScroll = -1;
      await expect.poll(async () => listScroll === (listScroll = await scrollTop())).toBe(true);
      const area = await freeMapArea(page);
      await touch.drag({ x: (area.left + area.right) / 2, y: (area.top + area.bottom) / 2 }, { x: 40, y: 40 });

      // THEN the map pans and the list keeps its scroll position
      const afterMap = await settledView(page);
      expect(Math.hypot(afterMap.x - afterList.x, afterMap.y - afterList.y)).toBeGreaterThan(30);
      expect(await scrollTop()).toBe(listScroll);
    });

    test("tapping a pin selects its place in the list; swiping the chips scrolls them, not the map", async ({ page }) => {
      // GIVEN the home screen of a visitor who dismissed the install hint (the page is one screen tall, so with the
      // hint an iPhone 15 keeps only a strip of map between the chips and the list, and the pins hide under them)
      await page.addInitScript(() => localStorage.setItem("kbb:install-dismissed", "1"));
      await openHome(page);
      const touch = await touchscreen(page);

      // WHEN the visitor taps the topmost pin under a free spot of its own
      const target = await pins(page).evaluateAll((els) => {
        for (const el of els) {
          const r = el.getBoundingClientRect();
          const at = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          const hit = document.elementFromPoint(at.x, at.y)?.closest("[data-place-id]");
          if (hit === el) return { id: (el as HTMLElement).dataset.placeId!, ...at };
        }
        return null;
      });
      expect(target).not.toBeNull();
      await touch.tap({ x: target!.x, y: target!.y });

      // THEN the pin is selected and its list row takes focus and scrolls into view inside the sheet,
      // without scrolling the page (which would slide the map under the header)
      await expect(page.locator(`[data-place-id="${target!.id}"]`)).toHaveAttribute("data-selected", "true");
      const row = page.getByRole("region", { name: "Lista miejsc" }).locator("li", { has: page.locator(":focus") });
      await expect(row).toHaveAttribute("data-selected", "true");
      await expect(row).toBeInViewport();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      // WHEN a finger swipes the category chips sideways
      const chips = page.getByRole("group", { name: "Kategorie" });
      const chip = (await chips.getByRole("button").nth(1).boundingBox())!;
      const before = await settledView(page);
      await touch.drag({ x: chip.x + chip.width / 2, y: chip.y + chip.height / 2 }, { x: -150, y: 0 });

      // THEN the chips scroll and the map stays put
      await expect.poll(() => chips.evaluate((el) => el.scrollLeft)).toBeGreaterThan(50);
      const after = await settledView(page);
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1);
    });
  });
}
