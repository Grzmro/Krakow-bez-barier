import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const liveRegion = (page: Page) => page.locator('div[role="status"][aria-atomic="true"]');
const list = (page: Page) => page.getByRole("region", { name: "Lista miejsc" });
const row = (page: Page, name: string) =>
  list(page).getByRole("listitem").filter({ has: page.getByRole("link", { name: new RegExp(name) }) });

/** Types a query and closes the suggestions, which hide the rest of the page from assistive tech while open. */
async function searchFor(page: Page, text: string) {
  const search = page.getByRole("combobox", { name: "Wyszukaj miejsce" });
  await search.fill(text);
  await expect(page.getByRole("listbox")).toBeVisible();
  await search.press("Escape");
  await expect(search).toHaveValue(text);
}

test("wheelchair profile on the home screen shows verdicts on the list and map, keeping search and filters", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a visitor on the home screen who searched for the sample places and picked a filter
  await page.goto("/");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  const search = page.getByRole("combobox", { name: "Wyszukaj miejsce" });
  await searchFor(page, "przyk");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("5 miejsc");
  await page.getByRole("button", { name: "Toaleta dostosowana", exact: true }).click();
  await page.getByRole("switch", { name: "Pokaż też miejsca bez danych" }).click();
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("5 miejsc");
  await expect(page.locator("[data-place-id][data-status]")).toHaveCount(0);

  // WHEN they turn on the wheelchair profile with one click
  await page.getByRole("radio", { name: "Wózek", exact: true }).check();

  // THEN every place gets a verdict without a reload, and the search and filter stay
  await expect(search).toHaveValue("przyk");
  await expect(page.getByRole("button", { name: "Toaleta dostosowana", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(row(page, "Hotel Przykład")).toContainText("Spełnia · niepotwierdzone");
  await expect(row(page, "Restauracja Przykład")).toContainText("Nie spełnia · 2 stopnie");
  await expect(row(page, "Kawiarnia Przykład")).toContainText("Brak danych");
  await expect(row(page, "Kawiarnia Przykład")).toContainText("Brak danych · Toaleta dostosowana");
  await expect(row(page, "Hotel Przykład")).not.toContainText("Toaleta dostosowana");
  await expect(liveRegion(page)).toHaveText("Profil: wózek. 5 miejsc: 1 spełnia, 1 nie spełnia, 3 brak danych, 0 sprzeczne.");

  // AND the map pins carry the same verdicts as the list
  await expect(page.locator('[data-place-id="hotel-przyklad"]')).toHaveAttribute("data-status", "met");
  await expect(page.locator('[data-place-id="restauracja-przyklad"]')).toHaveAttribute("data-status", "barrier");
  await expect(page.locator("[data-place-id][data-status]")).toHaveCount(5);

  // AND "Dlaczego?" explains the verdict under the row
  await row(page, "Hotel Przykład").getByRole("button", { name: "Dlaczego? Hotel Przykład" }).click();
  await expect(row(page, "Hotel Przykład").getByRole("heading", { name: "Pasuje (4)" })).toBeVisible();

  // AND nothing on the page asks about a disability
  await expect(page.locator("main")).not.toContainText(/niepełnospraw|diagnoz|choroba/i);
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "profile.aria.yml" });
  await expectAccessible();
  await evidence("home-profile");
});

test("counters filter by verdict and announce the result", async ({ page, evidence }) => {
  // GIVEN the wheelchair profile over the sample places
  await page.goto("/");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  await searchFor(page, "przyk");
  await page.getByRole("radio", { name: "Wózek", exact: true }).check();
  const counters = page.getByRole("group", { name: "Pokaż tylko miejsca z wynikiem" });
  await expect(counters.getByRole("button", { name: "1 spełnia" })).toBeVisible();

  // WHEN the "Spełnia" counter is pressed
  await counters.getByRole("button", { name: "1 spełnia" }).click();

  // THEN only that place stays on the list and the map, and the change is announced
  await expect(counters.getByRole("button", { name: "1 spełnia" })).toHaveAttribute("aria-pressed", "true");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("1 miejsce");
  await expect(row(page, "Hotel Przykład")).toBeVisible();
  await expect(page.locator("[data-place-id]")).toHaveCount(1);
  await expect(liveRegion(page)).toHaveText("Profil: wózek. Pokazano 1 z 5 miejsc: 1 spełnia, 1 nie spełnia, 3 brak danych, 0 sprzeczne.");
  await evidence("home-profile-counter");

  // WHEN the counter is released and failing places are hidden instead
  await counters.getByRole("button", { name: "1 spełnia" }).click();
  await page.getByRole("switch", { name: "Ukryj niespełniające" }).check();

  // THEN the barrier place disappears and the count is announced
  await expect(row(page, "Restauracja Przykład")).toHaveCount(0);
  await expect(liveRegion(page)).toHaveText("Profil: wózek. Pokazano 4 z 5 miejsc: 1 spełnia, 1 nie spełnia, 3 brak danych, 0 sprzeczne.");

  // WHEN a counter with no places is pressed
  await page.getByRole("switch", { name: "Ukryj niespełniające" }).uncheck();
  await counters.getByRole("button", { name: "0 sprzeczne" }).click();

  // THEN the empty state blames the verdict filter, not the search, and offers only to show everything
  await expect(list(page)).toContainText("Żadne miejsce nie pasuje do wybranego wyniku");
  await expect(page.getByRole("button", { name: "Szukaj w całym Krakowie" })).toHaveCount(0);
  await page.getByRole("button", { name: "Pokaż wszystkie wyniki" }).click();
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("5 miejsc");

  // WHEN a counter is pressed and the profile is switched to another one
  await counters.getByRole("button", { name: "1 spełnia" }).click();
  await page.getByRole("radio", { name: "Wózek dziecięcy" }).check();

  // THEN the counter is released, because the verdicts behind it have changed
  await expect(counters.getByRole("button", { pressed: true })).toHaveCount(0);
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("5 miejsc");
});

test("thresholds change verdicts, persist in the browser and reset to defaults", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the wheelchair profile is on
  await page.goto("/");
  await page.getByRole("radio", { name: "Wózek", exact: true }).check();
  await expect(row(page, "Hotel Przykład")).toContainText("Spełnia");

  // WHEN the user raises the minimum door width above the hotel's 90 cm
  await page.getByRole("button", { name: "Progi profilu" }).click();
  const drawer = page.getByRole("dialog", { name: "Progi profilu" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Zwiększ: Min. szerokość wejścia" }).click();
  await expect(drawer.getByRole("group", { name: "Min. szerokość wejścia" })).toContainText("95 cm");
  await expect(drawer).not.toContainText(/niepełnospraw|diagnoz|choroba/i);
  await expectAccessible();
  await evidence("home-profile-thresholds");
  await drawer.getByRole("button", { name: "Gotowe" }).click();

  // THEN the hotel no longer meets the profile
  await expect(row(page, "Hotel Przykład")).toContainText("Nie spełnia · drzwi 90 cm");

  // AND the profile and thresholds survive a reload (stored only in this browser)
  await page.reload();
  await expect(page.getByRole("radio", { name: "Wózek", exact: true })).toBeChecked();
  await expect(row(page, "Hotel Przykład")).toContainText("Nie spełnia");

  // AND "Przywróć domyślne" brings the presets back
  await page.getByRole("button", { name: "Progi profilu" }).click();
  await page.getByRole("button", { name: "Przywróć domyślne" }).click();
  await page.getByRole("button", { name: "Gotowe" }).click();
  await expect(row(page, "Hotel Przykład")).toContainText("Spełnia · niepotwierdzone");
});

test("a facility need switched on in the thresholds drawer joins the verdict", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the wheelchair profile on a small 360 px phone, under which the hotel meets every need
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByRole("radio", { name: "Wózek", exact: true }).check();
  await expect(row(page, "Hotel Przykład")).toContainText("Spełnia · niepotwierdzone");

  // WHEN the user also asks for a bench or another place to rest
  await page.getByRole("button", { name: "Progi profilu" }).click();
  const drawer = page.getByRole("dialog", { name: "Progi profilu" });
  const bench = drawer.getByRole("switch", { name: "Ławka lub miejsce odpoczynku" });
  await expect(bench).not.toBeChecked();
  await bench.check();
  await expect(bench).toBeChecked();
  await expect(drawer).toMatchAriaSnapshot({ name: "profile-thresholds.aria.yml" });
  await expectAccessible();
  const done = drawer.getByRole("button", { name: "Gotowe" });
  await expect(done).toBeInViewport();
  await evidence("home-profile-bench");
  await done.click();

  // THEN the hotel, with no bench data, is "can't say" instead of met, and says what is missing
  await expect(row(page, "Hotel Przykład")).toContainText("Brak danych · ławka");
});

test("no-data and conflicting places never meet a profile; turning it off returns the neutral view", async ({ page }) => {
  // GIVEN the stroller profile
  await page.goto("/");
  await page.getByRole("radio", { name: "Wózek dziecięcy" }).check();

  // THEN the incomplete and conflicting demo places are not "Spełnia"
  await expect(row(page, "Kawiarnia Przykład")).toContainText("Brak danych");
  await expect(row(page, "Pałac Krzysztofory")).not.toContainText("Spełnia");

  // WHEN the profile is turned off with one click
  await page.getByRole("radio", { name: "Profil wyłączony, widok dla każdego" }).check();

  // THEN verdicts disappear from the list and the map
  await expect(list(page).locator("[data-status]")).toHaveCount(0);
  await expect(page.locator("[data-place-id][data-status]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Progi profilu" })).toHaveCount(0);
});

test("profile, counters and details work from the keyboard", async ({ page }) => {
  // GIVEN the home screen with the sample places
  await page.goto("/");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  await searchFor(page, "Hotel");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("1 miejsce");

  // WHEN a keyboard user reaches the profile group and presses the arrow key
  const off = page.getByRole("radio", { name: "Profil wyłączony, widok dla każdego" });
  for (let i = 0; i < 30 && !(await off.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(off).toBeFocused();
  await page.keyboard.press("ArrowRight");

  // THEN the wheelchair profile is selected and verdicts appear
  await expect(page.getByRole("radio", { name: "Wózek", exact: true })).toBeChecked();
  await expect(row(page, "Hotel Przykład")).toContainText("Spełnia");

  // WHEN they tab to a counter and press it with the keyboard
  const met = page.getByRole("button", { name: "1 spełnia" });
  for (let i = 0; i < 10 && !(await met.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(met).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(met).toHaveAttribute("aria-pressed", "true");

  // AND open "Dlaczego?" for the row
  const why = page.getByRole("button", { name: "Dlaczego? Hotel Przykład" });
  for (let i = 0; i < 20 && !(await why.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(why).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(row(page, "Hotel Przykład").getByRole("heading", { name: "Pasuje (4)" })).toBeVisible();
});

test("the old /profil page is gone", async ({ page }) => {
  // GIVEN the profile now lives on the home screen
  // WHEN someone opens the old address
  const response = await page.goto("/profil");
  // THEN it does not exist
  expect(response?.status()).toBe(404);
});
