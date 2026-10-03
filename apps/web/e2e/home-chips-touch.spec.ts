import { devices, type Locator, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { finger } from "./touch";

// The phone the row was reported stuck on; real touch input through CDP (see touch.ts).
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 15"];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
// Every touch step waits for a rendered frame of the software-GL map (as in map-touch.spec.ts).
test.describe.configure({ timeout: 30_000 });

type Watched = HTMLElement & { movedByTest?: boolean };

/** Opens home with a still map that remembers whether it moved from now on. */
async function openHome(page: Page) {
  await page.addInitScript(() => localStorage.setItem("kbb:install-dismissed", "1"));
  await page.goto("/");
  const map = page.locator("main .maplibregl-map");
  await expect(map).toHaveAttribute("data-moving", "false");
  await map.evaluate((el: Watched) => {
    new MutationObserver(() => (el.movedByTest ||= el.dataset.moving === "true")).observe(el, { attributes: true });
  });
  return { mapMoved: () => map.evaluate((el: Watched) => el.movedByTest ?? false) };
}

/** The middle of the gap between a row's first two chips: no chip under the finger, only the row. */
const firstGap = (row: Locator) =>
  row.getByRole("button").evaluateAll((els) => {
    const [a, b] = els.map((el) => el.getBoundingClientRect());
    return { x: (a.right + b.left) / 2, y: a.top + a.height / 2 };
  });

const pageScroll = (page: Page) => page.evaluate(() => document.scrollingElement!.scrollTop);

test("a slanted swipe that starts between two category chips scrolls the row, not the map or the page", async ({ page, evidence }) => {
  // GIVEN the home screen with more category chips than fit the width
  const { mapMoved } = await openHome(page);
  const chips = page.getByRole("group", { name: "Kategorie" });
  await expect(chips.getByRole("button").nth(3)).toBeVisible();
  expect(await chips.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeGreaterThan(150);

  // WHEN a finger lands in the gap between the first two chips and swipes left, drifting down a little
  await (await finger(page)).drag(await firstGap(chips), { x: -150, y: 20 });

  // THEN the row itself scrolls, while the map never moves and the page stays put
  await expect.poll(() => chips.evaluate((el) => el.scrollLeft)).toBeGreaterThan(50);
  expect(await mapMoved()).toBe(false);
  expect(await pageScroll(page)).toBe(0);
  await evidence("home-chips-touch");
});

test("a drag on the map just below the category row still pans the map", async ({ page }) => {
  // GIVEN the home screen
  const { mapMoved } = await openHome(page);
  const row = (await page.getByRole("group", { name: "Kategorie" }).boundingBox())!;

  // WHEN a finger drags the map a few pixels under the row
  await (await finger(page)).drag({ x: row.x + row.width / 2, y: row.y + row.height + 12 }, { x: 40, y: 60 });

  // THEN the map moves
  await expect.poll(mapMoved).toBe(true);
});

test("a slanted swipe that starts between two feature filters scrolls them, not the panel or the map", async ({ page }) => {
  // GIVEN the list panel brought up at half height
  const { mapMoved } = await openHome(page);
  const panel = page.getByRole("region", { name: "Lista miejsc" });
  await panel.getByRole("button", { name: "Pokaż listę" }).click();
  await expect(panel).toHaveAttribute("data-stowed", "false");
  await expect.poll(() => panel.evaluate((el) => el.getAnimations().length)).toBe(0);
  const filters = panel.getByRole("group", { name: "Filtry cech" });
  await filters.scrollIntoViewIfNeeded();
  expect(await filters.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeGreaterThan(150);

  // WHEN a finger lands between the first two filters and swipes left, drifting down a little
  await (await finger(page)).drag(await firstGap(filters), { x: -150, y: 20 });

  // THEN the filters scroll; the panel keeps its height, and neither the map nor the page moves
  await expect.poll(() => filters.evaluate((el) => el.scrollLeft)).toBeGreaterThan(50);
  await expect(panel).toHaveAttribute("data-expanded", "false");
  await expect(panel).toHaveAttribute("data-stowed", "false");
  expect(await mapMoved()).toBe(false);
  expect(await pageScroll(page)).toBe(0);
});
