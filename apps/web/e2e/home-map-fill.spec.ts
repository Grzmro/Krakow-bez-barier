import { devices, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { expandClusters, markersSettled, pins } from "./map";
import { finger, type Point } from "./touch";

// One phone, the one the stretching map was reported on.
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 15"];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
// Every touch step waits for a rendered frame of the software-GL map (as in map-touch.spec.ts).
test.describe.configure({ timeout: 30_000 });

const panel = (page: Page) => page.getByRole("region", { name: "Lista miejsc" });
const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;
/** The map's own element, the one MapLibre draws into. */
const mapBox = (page: Page) => box(page, "main .maplibregl-map");

/** The panel's box once its height transition is over. */
async function settledPanel(page: Page) {
  await expect.poll(() => panel(page).evaluate((el) => el.getAnimations().length), { timeout: 10_000 }).toBe(0);
  return (await panel(page).boundingBox())!;
}

/** A point on the panel's top row, clear of the buttons on the right. */
async function topRow(page: Page): Promise<Point> {
  const row = (await panel(page).locator("> div").first().boundingBox())!;
  return { x: row.x + row.width * 0.3, y: row.y + Math.min(20, row.height / 2) };
}

async function openHome(page: Page) {
  // Without the install hint, as in map-touch.spec.ts: the page is one screen tall and the hint takes a strip of it.
  await page.addInitScript(() => localStorage.setItem("kbb:install-dismissed", "1"));
  await page.goto("/");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
  await settledPanel(page);
}

/** The attribution and the zoom buttons sit fully above the panel. */
async function expectControlsAbove(page: Page) {
  const top = (await settledPanel(page)).y;
  const zoomOut = (await page.getByRole("button", { name: "Oddal" }).boundingBox())!;
  const attribution = (await page.getByRole("button", { name: "Informacje o źródłach mapy" }).boundingBox())!;
  for (const control of [zoomOut, attribution]) expect(control.y + control.height).toBeLessThanOrEqual(top);
}

test("the map fills the screen at every panel height and while the panel is swiped", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the home screen with the list at half height
  await openHome(page);
  const main = (await page.locator("main").boundingBox())!;
  const half = await mapBox(page);

  // THEN the map covers the whole home screen, under the panel too, with its controls above the panel
  expect(half).toEqual(main);
  await expectControlsAbove(page);

  // WHEN the list is stowed to the bar (measured mid-transition and once it has settled)
  await panel(page).getByRole("button", { name: "Schowaj listę" }).click();
  expect(await mapBox(page)).toEqual(half);
  await expect(panel(page)).toHaveAttribute("data-stowed", "true");

  // THEN the map keeps exactly its size, and its controls ride down with the panel
  await settledPanel(page);
  expect(await mapBox(page)).toEqual(half);
  await expectControlsAbove(page);
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-map-fill-stowed.aria.yml" });
  await expectAccessible();
  await evidence("home-map-fill-stowed");

  // WHEN the list comes back and is expanded to nearly full height
  await panel(page).getByRole("button", { name: "Pokaż listę" }).click();
  await expect(panel(page)).toHaveAttribute("data-stowed", "false");
  await panel(page).getByRole("button", { name: "Rozwiń arkusz" }).click();
  await expect(panel(page)).toHaveAttribute("data-expanded", "true");

  // THEN the map is still the same size
  await settledPanel(page);
  expect(await mapBox(page)).toEqual(half);

  // WHEN it is collapsed to half and a finger drags the panel up without lifting
  await panel(page).getByRole("button", { name: "Zwiń arkusz" }).click();
  const collapsed = await settledPanel(page);
  const touch = await finger(page);
  await touch.press(await topRow(page), -80);

  // THEN the panel follows the finger, and the map under it doesn't change
  expect((await panel(page).boundingBox())!.height).toBeGreaterThan(collapsed.height + 40);
  expect(await mapBox(page)).toEqual(half);
  await touch.lift();
  await settledPanel(page);
  expect(await mapBox(page)).toEqual(half);
  await evidence("home-map-fill-half");
});

test("a place picked in the list is moved into view above the panel, and stays there", async ({ page, evidence }) => {
  // GIVEN the home screen zoomed in to single pins, and the map dragged down so that some pins sink under the panel
  await openHome(page);
  await expandClusters(page);
  const chips = await box(page, '[aria-label="Kategorie"]');
  const top = (await panel(page).boundingBox())!.y;
  const zoom = (await page.getByRole("button", { name: "Przybliż" }).boundingBox())!;
  await (await finger(page)).swipe({ x: (16 + zoom.x) / 2, y: chips.y + chips.height + 16 }, top - chips.y - chips.height - 40, { hold: true });
  await markersSettled(page);
  const id = await pins(page).evaluateAll(
    (els, panelTop) => (els.find((el) => el.getBoundingClientRect().top > panelTop) as HTMLElement | undefined)?.dataset.placeId,
    top,
  );
  expect(id, "a pin under the panel").toBeDefined();
  const pin = page.locator(`[data-place-id="${id}"]`);

  // WHEN that place's row in the list is focused (as a tap on it or Tab does)
  await panel(page).locator(`a[href$="/${id}"]`).focus();

  // THEN the map eases until its pin is selected and shows between the chips and the panel
  await expect(pin).toHaveAttribute("data-selected", "true");
  const shown = async () => {
    await markersSettled(page);
    const p = (await pin.boundingBox())!;
    const panelTop = (await settledPanel(page)).y;
    return p.y >= chips.y + chips.height && p.y + p.height <= panelTop;
  };
  await expect.poll(shown).toBe(true);
  await evidence("home-map-fill-selected");

  // WHEN the panel is expanded and collapsed again, THEN the pin is still in view above it
  await panel(page).getByRole("button", { name: "Rozwiń arkusz" }).click();
  await expect(panel(page)).toHaveAttribute("data-expanded", "true");
  await panel(page).getByRole("button", { name: "Zwiń arkusz" }).click();
  await expect(panel(page)).toHaveAttribute("data-expanded", "false");
  await expect.poll(shown).toBe(true);

  // WHEN the list is stowed to the bar, THEN the pin is still in view above the bar
  await panel(page).getByRole("button", { name: "Schowaj listę" }).click();
  await expect(panel(page)).toHaveAttribute("data-stowed", "true");
  await expect.poll(shown).toBe(true);
});
