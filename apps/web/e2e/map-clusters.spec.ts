import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { clusters, markersSettled, pins, placesOnMap } from "./map";

const list = (page: Page) => page.getByRole("region", { name: "Lista miejsc" });
const liveRegion = (page: Page) => page.locator('div[role="status"][aria-atomic="true"]');

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

// Pixel 7 with touch (the default project): every tap below is a real touch event.
// Each zoom waits for the software-GL map to settle, like the touch specs.
test.describe.configure({ timeout: 30_000 });

test("tapping a cluster zooms in until its places are pins, and a pin leads to the place card", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the home screen zoomed out to the sample places
  await page.goto("/");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("9 miejsc");

  // THEN nearby places merge into clusters, named with their number of places, and none is left out
  await expect(page.getByRole("img", { name: /^Grupa: \d+ miejsc/ }).first()).toBeVisible();
  await expect.poll(() => placesOnMap(page)).toBe(9);
  await markersSettled(page);
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

test("with a profile on, clusters tell their verdicts in words", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the home screen
  await page.goto("/");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("9 miejsc");

  // WHEN the visitor turns on the wheelchair profile
  await page.getByRole("radio", { name: "Wózek", exact: true }).check();

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
});
