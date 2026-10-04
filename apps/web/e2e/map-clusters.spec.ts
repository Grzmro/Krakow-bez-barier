import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { clusters, expandClusters, markersSettled, pins, placesOnMap, gotoAllPlaces } from "./map";

const list = (page: Page) => page.getByRole("region", { name: "Lista miejsc" });
const liveRegion = (page: Page) => page.locator('div[role="status"][aria-atomic="true"]');
const canvas = (page: Page) => page.locator("canvas.maplibregl-canvas");

/** Centre of the first marker a finger can reach: not under the search bar, chips, controls or sheet. */
async function reachable(markers: Locator) {
  const at = await markers.evaluateAll((els) => {
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const point = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      if (document.elementFromPoint(point.x, point.y)?.closest(".maplibregl-marker") === el) return point;
    }
    return null;
  });
  expect(at, "a marker not covered by the overlays").not.toBeNull();
  return at!;
}

/** Records the keyframes of every transition a map marker runs, as JSON, in `window.__markerMotion`. */
async function recordMarkerMotion(page: Page) {
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __markerMotion: string[] }).__markerMotion = log;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (this.closest(".maplibregl-marker")) log.push(JSON.stringify(keyframes));
      return animate.call(this, keyframes, options);
    };
  });
}

const markerMotion = (page: Page) => page.evaluate(() => (window as unknown as { __markerMotion: string[] }).__markerMotion);

// Pixel 7 with touch (the default project): every tap below is a real touch event.
// Each zoom waits for the software-GL map to settle, like the touch specs.
test.describe.configure({ timeout: 30_000 });

test("tapping a cluster zooms in until its places are pins, and a pin leads to the place card", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the home screen zoomed out to the sample places
  await recordMarkerMotion(page);
  await gotoAllPlaces(page);
  const heading = list(page).getByRole("heading", { level: 2 });
  await expect(heading).toHaveText(/^\d+ miejsc/);

  // THEN nearby places merge into clusters, named with their number of places, and no listed place is left out
  // (the list follows the map's view, so it holds the places in view; the map may hold a few around it too)
  await expect(page.getByRole("img", { name: /^Grupa: \d+ miejsc/ }).first()).toBeVisible();
  await markersSettled(page);
  const listed = Number((await heading.textContent())?.match(/\d+/)?.[0]);
  await expect.poll(() => placesOnMap(page)).toBeGreaterThanOrEqual(listed);
  // AND a screen reader hears how many places are in view
  await expect(canvas(page)).toHaveAccessibleDescription(/^W widoku: \d+ miejsc/);
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "map-clusters.aria.yml" });
  await expectAccessible();
  await evidence("map-clusters");

  // WHEN a row on the list is focused
  await list(page).getByRole("link").first().focus();

  // THEN the map marks the one marker that holds that place, even when it is inside a cluster
  await expect(page.locator('.maplibregl-marker[data-selected="true"]')).toHaveCount(1);
  await evidence("map-clusters-selected");

  // WHEN the visitor taps a cluster
  const tapped = await reachable(clusters(page));
  const count = await page.evaluate(
    ({ x, y }) => (document.elementFromPoint(x, y)?.closest("[data-cluster-count]") as HTMLElement).dataset.clusterCount,
    tapped,
  );
  await page.touchscreen.tap(tapped.x, tapped.y);

  // THEN the map zooms in on it and says so
  await expect(liveRegion(page)).toHaveText(new RegExp(`^Przybliżono: ${count} miejsc`));

  // WHEN they keep tapping clusters until pins show
  for (let i = 0; i < 8 && (await pins(page).count()) === 0; i++) {
    await markersSettled(page);
    if ((await pins(page).count()) > 0) break;
    const next = await reachable(clusters(page));
    await page.touchscreen.tap(next.x, next.y);
  }
  await markersSettled(page);
  await evidence("map-clusters-zoomed");

  // AND the places flew out of their cluster to their spots rather than popping in
  expect(await markerMotion(page)).toContainEqual(expect.stringMatching(/translate\(-?[1-9]/));

  // THEN each pin shows its category's icon and names the place on hover
  const firstPin = pins(page).first();
  await expect(firstPin).toHaveAttribute("data-category", /^[a-z_]+$/);
  await expect(firstPin).toHaveAttribute("title", /\S · \S/);
  await expect(firstPin.locator("svg svg")).toHaveCount(1);

  // AND tap a pin
  const pin = await reachable(pins(page));
  const id = await page.evaluate(
    ({ x, y }) => (document.elementFromPoint(x, y)?.closest("[data-place-id]") as HTMLElement).dataset.placeId,
    pin,
  );
  await page.touchscreen.tap(pin.x, pin.y);

  // THEN its row on the list is selected, and the row opens the place card
  const row = list(page).locator("li", { has: page.locator(":focus") });
  await expect(row).toHaveAttribute("data-selected", "true");
  await row.getByRole("link").first().tap();
  await expect(page).toHaveURL(new RegExp(`/miejsca/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test.describe("with less motion asked for", () => {
  test.use({ reducedMotion: "reduce" });

  test("clusters split into pins with a fade only: nothing flies or scales", async ({ page }) => {
    // GIVEN the system's "reduce motion" and the home screen with clusters
    await recordMarkerMotion(page);
    await gotoAllPlaces(page);
    await expect(clusters(page).first()).toBeVisible();

    // WHEN the visitor taps a cluster and keeps zooming until pins show
    await markersSettled(page);
    const tapped = await reachable(clusters(page));
    await page.touchscreen.tap(tapped.x, tapped.y);
    await expandClusters(page);

    // THEN the pins are there, and every marker transition was a fade without movement
    await expect(pins(page).first()).toBeAttached();
    const motion = await markerMotion(page);
    expect(motion.length).toBeGreaterThan(0);
    expect(motion.filter((keyframes) => keyframes.includes("transform"))).toEqual([]);
  });
});

test("with a profile on, clusters tell their verdicts in words", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the home screen
  await gotoAllPlaces(page);
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText(/^\d+ miejsc/);

  // WHEN the visitor turns on the wheelchair profile
  // (by keyboard: after a click the rows grow with their verdicts under the resting pointer, the hovered row gets
  // selected and the map eases to it, away from the clusters; a phone has no hover)
  const wheelchair = page.getByRole("radio", { name: "Wózek", exact: true });
  await wheelchair.focus();
  await page.keyboard.press("Space");
  await expect(wheelchair).toBeChecked();

  // THEN each cluster's name breaks its places down by verdict, so the donut never relies on colour
  const cluster = page.getByRole("img", { name: /^Grupa: \d+ miejsc/ }).first();
  await expect(cluster).toHaveAccessibleName(/\((Spełnia|Sprzeczne|Brak danych|Nie spełnia): \d+/);
  await expect(clusters(page).first()).toHaveAttribute("data-verdicts", /\w+:\d+/);
  await markersSettled(page);
  await expectAccessible();
  await evidence("map-clusters-profile");

  // WHEN the visitor taps a cluster
  await markersSettled(page);
  const tapped = await reachable(clusters(page));
  await page.touchscreen.tap(tapped.x, tapped.y);

  // THEN the announcement repeats the breakdown in words, as the donut's colours alone don't tell it
  await expect(liveRegion(page)).toHaveText(/^Przybliżono: \d+ miejsc\w* \((Spełnia|Sprzeczne|Brak danych|Nie spełnia): \d+/);

  // WHEN the clusters are expanded into pins
  await expandClusters(page);
  await evidence("map-pins-profile");

  // THEN every pin carries a category and a verdict, and its hover hint says the verdict in words
  const pin = pins(page).first();
  await expect(pin).toHaveAttribute("data-category", /^[a-z_]+$/);
  await expect(pin).toHaveAttribute("data-status", /^(met|barrier|conflict|unknown)$/);
  await expect(pin).toHaveAttribute("title", / · (Spełnia|Sprzeczne|Brak danych|Nie spełnia)$/);
});
