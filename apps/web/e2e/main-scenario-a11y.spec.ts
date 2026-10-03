import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { horizontalOverflow, SCREENS, tabTo } from "./a11y";
import { expandClusters, placesOnMap, verdictsOnMap } from "./map";

// Accessibility check of the demo's main scenario (docs/demo-script.md, scene 8): every screen the
// jury sees, with axe, the keyboard alone, 200% zoom / 320 px reflow, and the map available as text.
// Results feed the "Deklaracja dostępności" page.

const list = (page: Page) => page.getByRole("region", { name: "Lista miejsc" });

test("the demo scenario works from the keyboard alone, with axe passing on every step", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  test.setTimeout(60_000);
  // GIVEN the home screen
  await page.goto("/");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("10 miejsc");

  // WHEN a keyboard user searches for the hotel and picks the suggestion
  const search = page.getByRole("combobox", { name: "Wyszukaj miejsce" });
  await tabTo(page, search);
  await page.keyboard.type("Hotel");
  await expect(page.getByRole("option", { name: "Hotel Przykład" })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("1 miejsce");

  // AND turns on the wheelchair profile with the arrow key
  await tabTo(page, page.getByRole("radio", { name: "Profil wyłączony, widok dla każdego" }));
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Wózek", exact: true })).toBeChecked();
  const row = list(page).getByRole("link", { name: /Hotel Przykład/ });
  const item = list(page).getByRole("listitem").filter({ has: page.getByRole("link", { name: /Hotel Przykład/ }) });
  await expect(item).toContainText("Spełnia");
  // axe would read the profile switch mid colour transition; let it settle first.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await expectAccessible();

  // AND opens the profile thresholds and closes them with Escape
  const thresholds = page.getByRole("button", { name: "Progi profilu" });
  await tabTo(page, thresholds);
  await page.keyboard.press("Enter");
  const thresholdsDrawer = page.getByRole("dialog", { name: "Progi profilu" });
  await expect(thresholdsDrawer).toBeVisible();
  await page.keyboard.press("Escape");

  // THEN focus returns to the button that opened them
  await expect(thresholdsDrawer).toBeHidden();
  await expect(thresholds).toBeFocused();

  // WHEN they open the place card from the list
  await tabTo(page, row);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Hotel Przykład" })).toBeVisible();

  // THEN a fact opens with Enter and shows its source and date
  const door = page.getByRole("button", { name: /Szerokość drzwi/ });
  await tabTo(page, door);
  await page.keyboard.press("Enter");
  await expect(door).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(`#${await door.getAttribute("aria-controls")}`)).toContainText("Źródło");
  // axe's target-size counts only the visible part of a control, so one half under the sticky header fails
  // depending on where focus scrolled the page; centre the focused fact so the result doesn't hang on row heights.
  await door.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expectAccessible();

  // WHEN they open the report form on that fact and close it with Escape
  const doorRow = page.locator("li").filter({ has: door });
  await tabTo(page, doorRow.getByRole("button", { name: "To się nie zgadza" }));
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "To się nie zgadza" });
  await expect(drawer).toBeVisible();
  await expectAccessible();
  await page.keyboard.press("Escape");

  // THEN focus returns to the button that opened it — no trap, nothing lost
  await expect(drawer).toBeHidden();
  const reportButton = doorRow.getByRole("button", { name: "To się nie zgadza" });
  await expect(reportButton).toBeFocused();

  // WHEN they reopen it, type the real width and send it with the keyboard
  await page.keyboard.press("Enter");
  const width = drawer.getByRole("spinbutton", { name: /Jak jest naprawdę/ });
  await expect(width).toBeFocused();
  await page.keyboard.type("90");
  await tabTo(page, drawer.getByRole("button", { name: "Wyślij" }));
  await page.keyboard.press("Enter");

  // THEN the report is listed under the fact and focus is back on the opener
  await expect(drawer).toBeHidden();
  await expect(doorRow).toContainText("Twoje zgłoszenie:90 cm");
  await expect(reportButton).toBeFocused();
  await evidence("a11y-keyboard-pass");
});

test("everything pinned on the map is also on the text list", async ({ page }) => {
  // GIVEN the home screen with the stroller profile, so pins and clusters carry verdicts
  await page.goto("/");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
  await page.getByRole("radio", { name: "Wózek dziecięcy" }).check();

  // WHEN every row has its verdict for the new profile
  await expect(list(page).getByRole("listitem").filter({ has: page.locator("[data-verdict]") })).toHaveCount(10);
  const rows = await list(page)
    .getByRole("listitem")
    .evaluateAll((items) =>
      items.reduce<Record<string, number>>((tally, li) => {
        const verdict = li.querySelector("[data-verdict]")!.getAttribute("data-verdict")!;
        return { ...tally, [verdict]: (tally[verdict] ?? 0) + 1 };
      }, {}),
    );

  // THEN the map's pins and clusters hold the same places with the same verdicts
  await expect.poll(() => placesOnMap(page)).toBe(10);
  await expect.poll(() => verdictsOnMap(page)).toEqual(rows);

  // AND once zoomed in, each pin has a row with its verdict
  await expandClusters(page);
  const pinned = await page.locator("[data-place-id]").evaluateAll((els) =>
    els.map((el) => `${el.getAttribute("data-place-id")}:${el.getAttribute("data-status")}`),
  );
  const listed = await list(page)
    .getByRole("listitem")
    .evaluateAll((items) =>
      items.map((li) => `${li.querySelector("a")?.getAttribute("href")?.split("/").pop()}:${li.querySelector("[data-verdict]")?.getAttribute("data-verdict")}`),
    );
  expect(pinned.length).toBeGreaterThan(0);
  expect(listed).toEqual(expect.arrayContaining(pinned));
});

for (const zoom of [
  { name: "200% zoom", viewport: { width: 640, height: 400 } },
  { name: "320 px reflow", viewport: { width: 320, height: 640 } },
]) {
  test.describe(zoom.name, () => {
    test.use({ viewport: zoom.viewport });

    for (const screen of SCREENS) {
      test(`${screen.name} reflows without horizontal scrolling and passes axe`, async ({
        page,
        expectAccessible,
        evidence,
      }) => {
        // GIVEN a screen of the demo scenario, zoomed in
        await page.goto(screen.url);
        await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeAttached();

        // THEN the content fits the width — nothing needs sideways scrolling
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

        // AND it has no WCAG 2.2 AA violations axe can detect
        await expectAccessible();
        if (screen.name === "home" || screen.name === "place-conflict") {
          await evidence(`a11y-${zoom.viewport.width}-${screen.name}`);
        }
      });
    }
  });
}
