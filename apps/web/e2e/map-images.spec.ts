import { expect, test } from "./fixtures";

// A wide window shows enough of the Old Town for the basemap's POIs without a sprite icon (gate, bollard, atm…).
test.use({ isMobile: false, hasTouch: false, viewport: { width: 1440, height: 1000 } });
test.describe.configure({ timeout: 30_000 });

test("zoomed in to street level, the map has an image for every icon its style asks for", async ({ page, evidence }) => {
  const missing: string[] = [];
  page.on("console", (message) => {
    if (/could not be loaded|styleimagemissing/.test(message.text())) missing.push(message.text());
  });

  // GIVEN the home screen with the map over the Old Town
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Lista miejsc" }).getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible();
  await page.waitForLoadState("networkidle");

  // WHEN the visitor zooms in with the keyboard down to the level where shops, gates and bollards show
  await canvas.focus();
  for (let step = 0; step < 3; step++) {
    await page.keyboard.press("Equal");
    await page.waitForLoadState("networkidle");
  }
  await page.keyboard.press("ArrowDown");
  await page.waitForLoadState("networkidle");
  await evidence("map-images-zoomed");

  // THEN no icon was missing: neither the basemap's POIs nor our own markers fall back to a placeholder
  expect(missing).toEqual([]);
});
