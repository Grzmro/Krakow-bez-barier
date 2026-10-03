import type { Page } from "@playwright/test";
import { horizontalOverflow, SCREENS, tabTo } from "./a11y";
import { expect, test } from "./fixtures";
import { placesOnMap, gotoAllPlaces } from "./map";

// The accessibility check of the demo's main scenario (main-scenario-a11y.spec.ts) on the laptop the demo video is
// recorded on: 1440×900 (the desktop project), the keyboard alone, and browser zoom. Results feed the
// "Deklaracja dostępności" page; the desktop-*.png evidence is compared with the desktop layout tasks.

const list = (page: Page) => page.getByRole("region", { name: "Lista miejsc" });

const DESKTOP_SCREENS = [...SCREENS, { name: "widget", url: "/widget/hotel-przyklad", heading: /Hotel Przykład/ }];

for (const screen of DESKTOP_SCREENS) {
  test(`${screen.name} fits the 1440 px window and passes axe`, async ({ page, expectAccessible, evidence }) => {
    // GIVEN a screen of the demo scenario on a laptop
    await page.goto(screen.url);
    await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeAttached();
    if (screen.name === "home") await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("Najbliżej Rynku (bez lokalizacji)");

    // THEN nothing needs sideways scrolling
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // AND it has no WCAG 2.2 AA violations axe can detect
    await expectAccessible();
    await evidence(`desktop-${screen.name}`);
  });
}

test("on a laptop the scenario works from the keyboard alone and focus returns from every dialog", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  test.setTimeout(30_000);
  // GIVEN the home screen on a laptop
  await gotoAllPlaces(page);
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("10 miejsc");

  // WHEN a keyboard user searches for the hotel, picks the suggestion and turns on the wheelchair profile
  await tabTo(page, page.getByRole("combobox", { name: "Wyszukaj miejsce" }));
  await page.keyboard.type("Hotel");
  await expect(page.getByRole("option", { name: "Hotel Przykład" })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("1 miejsce");
  await tabTo(page, page.getByRole("radio", { name: "Profil wyłączony, widok dla każdego" }));
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Wózek", exact: true })).toBeChecked();

  // AND opens the profile thresholds and closes them with Escape
  const thresholds = page.getByRole("button", { name: "Progi profilu" });
  await tabTo(page, thresholds);
  await page.keyboard.press("Enter");
  const thresholdsDrawer = page.getByRole("dialog", { name: "Progi profilu" });
  await expect(thresholdsDrawer).toBeVisible();
  await expectAccessible();
  await page.keyboard.press("Escape");

  // THEN focus returns to the button that opened them
  await expect(thresholdsDrawer).toBeHidden();
  await expect(thresholds).toBeFocused();

  // WHEN they open the place card from the list and the report form on a fact
  await tabTo(page, list(page).getByRole("link", { name: /Hotel Przykład/ }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Hotel Przykład" })).toBeVisible();
  const door = page.getByRole("button", { name: /Szerokość drzwi/ });
  const report = page.locator("li").filter({ has: door }).getByRole("button", { name: "To się nie zgadza" });
  await tabTo(page, report);
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "To się nie zgadza" });
  await expect(drawer).toBeVisible();
  await expectAccessible();
  await evidence("desktop-place-report");
  await page.keyboard.press("Escape");

  // THEN the form closes and focus is back on its opener
  await expect(drawer).toBeHidden();
  await expect(report).toBeFocused();
});

test("on a laptop every place on the map is also on the list beside it", async ({ page }) => {
  // GIVEN the home screen on a laptop, list panel and map side by side
  await gotoAllPlaces(page);
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("10 miejsc");

  // THEN the map holds the same nine places the list names
  await expect(list(page).getByRole("listitem")).toHaveCount(10);
  await expect.poll(() => placesOnMap(page)).toBe(10);
});

// Browser zoom on the 1440×900 laptop: the CSS window shrinks by the zoom factor while the pixel density grows.
for (const zoom of [
  { name: "200% browser zoom", viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 },
  { name: "400% browser zoom", viewport: { width: 360, height: 225 }, deviceScaleFactor: 4 },
]) {
  test.describe(zoom.name, () => {
    test.use({ viewport: zoom.viewport, deviceScaleFactor: zoom.deviceScaleFactor });

    for (const screen of DESKTOP_SCREENS) {
      test(`${screen.name} reflows without horizontal scrolling and passes axe`, async ({
        page,
        expectAccessible,
        evidence,
      }) => {
        // GIVEN a screen of the demo scenario, zoomed in on a laptop
        await page.goto(screen.url);
        await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeAttached();

        // THEN the content fits the width — nothing needs sideways scrolling
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

        // AND it has no WCAG 2.2 AA violations axe can detect
        await expectAccessible();
        if (screen.name === "home" || screen.name === "place-conflict") {
          await evidence(`desktop-zoom-${zoom.deviceScaleFactor * 100}-${screen.name}`);
        }
      });
    }
  });
}
