import { devices, type Locator, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { finger, type Point } from "./touch";

// The recorded Dworzec Główny → Rynek route (see route.spec.ts): no network, no key.
const panel = (page: Page) => page.getByRole("region", { name: "Odcinki trasy" });

/** A point on the panel's top row (grabber row or stowed bar), clear of the buttons on the right. */
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

async function openRoute(page: Page) {
  await page.goto("/trasa?z=station");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
  await expect(panel(page)).toHaveAttribute("data-expanded", "false");
  return settledHeight(page);
}

test.describe("route panel swipe on iPhone 15", () => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 15"];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
  // Every touch step waits for a rendered frame of the software-GL map (as in home-swipe.spec.ts).
  test.describe.configure({ timeout: 30_000 });

  test("swiping the grabber down stows the panel to the bar, with the map controls above it", async ({
    page,
    expectAccessible,
    evidence,
  }) => {
    // GIVEN the route screen with the panel at half height
    const half = await openRoute(page);
    const touch = await finger(page);

    // WHEN a finger swipes the grabber down most of the way to the bottom
    const grabber = await centre(panel(page).getByRole("button", { name: "Rozwiń arkusz" }));
    await touch.swipe(grabber, Math.min(0.8 * half, page.viewportSize()!.height - grabber.y - 4));

    // THEN only the bar with the route's time is left, its "show" button is focused, and the page didn't scroll
    expect(await pageScroll(page)).toBe(0);
    await expect(panel(page)).toHaveAttribute("data-stowed", "true");
    const show = panel(page).getByRole("button", { name: "Pokaż szczegóły" });
    await expect(show).toBeFocused();
    await expect(show).toHaveAttribute("aria-expanded", "false");
    await expect(panel(page)).toContainText("19 min");
    await expect(panel(page).getByRole("button", { name: "Ruszamy" })).toHaveCount(0);
    // AND the page keeps a title for screen readers while the panel's own heading is hidden
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trasa");
    const bar = await settledHeight(page);
    expect(bar).toBeLessThan(half / 2);

    // AND the zoom buttons ride just above the bar, on the full-screen map
    const zoomIn = (await page.getByRole("button", { name: "Przybliż" }).boundingBox())!;
    const panelTop = (await panel(page).boundingBox())!.y;
    expect(zoomIn.y + zoomIn.height).toBeLessThanOrEqual(panelTop);
    expect(panelTop - (zoomIn.y + zoomIn.height)).toBeLessThan(140);
    await expect(page.locator("main")).toMatchAriaSnapshot({ name: "route-swipe-stowed.aria.yml" });
    await expectAccessible();
    await evidence("route-swipe-stowed");
  });

  test("swiping the bar up brings the panel back at half height, with „Ruszamy”", async ({ page }) => {
    // GIVEN the route panel stowed earlier in this session
    await page.addInitScript(() => sessionStorage.setItem("kbb-route-stowed", "1"));
    await page.goto("/trasa?z=station");
    await expect(panel(page)).toHaveAttribute("data-stowed", "true");
    const bar = await settledHeight(page);
    const half = 0.48 * (await page.locator("main").boundingBox())!.height;
    const touch = await finger(page);

    // WHEN a finger swipes the bar up, most of the way to half height
    await touch.swipe(await topRow(page), -0.8 * (half - bar));

    // THEN the panel is back at half height with the route, its start button and the hide button focused
    await expect(panel(page)).toHaveAttribute("data-stowed", "false");
    await expect(panel(page)).toHaveAttribute("data-expanded", "false");
    expect(await pageScroll(page)).toBe(0);
    await expect(panel(page).getByRole("button", { name: "Schowaj szczegóły trasy" })).toBeFocused();
    await expect(panel(page).getByRole("button", { name: "Ruszamy" })).toBeVisible();
    expect(await settledHeight(page)).toBeGreaterThan(bar * 2);
  });

  test("the buttons stow and bring back the panel without a swipe", async ({ page }) => {
    // GIVEN the route screen with the panel at half height
    await openRoute(page);

    // WHEN the hide button is pressed from the keyboard
    await panel(page).getByRole("button", { name: "Schowaj szczegóły trasy" }).press("Enter");

    // THEN the panel is stowed and the show button has focus
    await expect(panel(page)).toHaveAttribute("data-stowed", "true");
    const show = panel(page).getByRole("button", { name: "Pokaż szczegóły" });
    await expect(show).toBeFocused();

    // WHEN it is pressed
    await page.keyboard.press("Enter");

    // THEN the panel is back at half height
    await expect(panel(page)).toHaveAttribute("data-stowed", "false");
    await expect(panel(page)).toHaveAttribute("data-expanded", "false");
  });

  test("the route screen fits the screen, so nothing but the panel moves", async ({ page }) => {
    // GIVEN the route screen at phone size
    await openRoute(page);

    // THEN the document is no taller than the viewport and can't be scrolled
    const { scrollHeight, innerHeight } = await page.evaluate(() => ({
      scrollHeight: document.scrollingElement!.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(scrollHeight).toBeLessThanOrEqual(innerHeight);
    expect(await pageScroll(page)).toBe(0);
  });
});
