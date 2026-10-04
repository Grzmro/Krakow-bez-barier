import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { verdictsOnMap, gotoAllPlaces, showResults } from "./map";

const liveRegion = (page: Page) => page.locator('div[role="status"][aria-atomic="true"]');
const list = (page: Page) => page.getByRole("region", { name: "Lista miejsc" });
const row = (page: Page, name: string) =>
  list(page).getByRole("listitem").filter({ has: page.getByRole("link", { name: new RegExp(name) }) });

/**
 * Types a query, closes the suggestions (an open popup hides the rest of the page from assistive tech) and searches.
 * `suggests`: a place name other than the text itself will be suggested; wait for it so the popup is settled, since
 * Escape on a popup that already closed clears the field. A whole place name is never suggested, so its popup stays
 * shut. (A text that only names a category, like "Hotel", picks the category on Enter, by design.)
 */
async function searchFor(page: Page, text: string, suggests?: string) {
  const search = page.getByRole("combobox", { name: "Wyszukaj miejsce" });
  await search.fill(text);
  if (suggests) {
    await expect(page.getByRole("option", { name: suggests })).toBeVisible();
    await search.press("Escape");
  }
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await search.press("Enter");
  await expect(search).toHaveValue(text);
}

test("wheelchair profile on the home screen shows verdicts on the list and map, keeping search and filters", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a visitor on the home screen who searched for the sample places and picked a filter
  await gotoAllPlaces(page);
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
  const search = page.getByRole("combobox", { name: "Wyszukaj miejsce" });
  await searchFor(page, "przyk", "Hotel Przykład");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("5 miejsc");
  await page.getByRole("button", { name: "Toaleta dostosowana", exact: true }).click();
  await page.getByRole("switch", { name: "Pokaż też miejsca bez danych" }).click();
  await showResults(page);
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

  // AND the map's pins and clusters carry the same verdicts as the list
  await expect.poll(() => verdictsOnMap(page)).toEqual({ met: 1, barrier: 1, unknown: 3 });

  // AND "Dlaczego?" explains the verdict under the row
  const why = row(page, "Hotel Przykład").getByRole("button", { name: "Dlaczego Hotel Przykład spełnia?" });
  await expect(row(page, "Restauracja Przykład").getByRole("button", { name: "Dlaczego Restauracja Przykład nie spełnia?" })).toBeVisible();
  await expect(row(page, "Bistro Przykład").getByRole("button", { name: "Dlaczego Bistro Przykład ma brak danych?" })).toBeVisible();
  await expect(why).toHaveAttribute("aria-expanded", "false");
  await why.click();

  // AND the button shows its open state and the row link was not followed
  // (the home URL carries the search since KBB-161, so check it is still the home screen, not the card)
  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(row(page, "Hotel Przykład").getByRole("button", { name: "Ukryj uzasadnienie: Hotel Przykład" })).toHaveAttribute("aria-expanded", "true");
  await expect(row(page, "Hotel Przykład").getByRole("heading", { name: "Pasuje (4)" })).toBeVisible();

  // AND nothing on the page asks about a disability
  await expect(page.getByRole("group", { name: "Profil potrzeb" })).not.toContainText(/niepełnospraw|diagnoz|choroba/i);
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "profile.aria.yml" });
  await expectAccessible();
  await evidence("home-profile");
});

/** The wheelchair profile over the five sample places; returns the verdict counters. */
async function wheelchairOverSamples(page: Page) {
  await gotoAllPlaces(page);
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
  await searchFor(page, "przyk", "Hotel Przykład");
  await page.getByRole("radio", { name: "Wózek", exact: true }).check();
  const counters = page.getByRole("group", { name: "Pokaż tylko miejsca z wynikiem" });
  await expect(counters.getByRole("button", { name: "1 spełnia" })).toBeVisible();
  return counters;
}

test("a verdict counter filters the list and the map and announces the result", async ({ page, evidence }) => {
  // GIVEN the wheelchair profile over the sample places
  const counters = await wheelchairOverSamples(page);

  // WHEN the "Spełnia" counter is pressed
  await counters.getByRole("button", { name: "1 spełnia" }).click();

  // THEN only that place stays on the list and the map, and the change is announced
  await expect(counters.getByRole("button", { name: "1 spełnia" })).toHaveAttribute("aria-pressed", "true");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("1 miejsce");
  await expect(row(page, "Hotel Przykład")).toBeVisible();
  await expect(page.locator("[data-place-id]")).toHaveCount(1);
  await expect(liveRegion(page)).toHaveText("Profil: wózek. Pokazano 1 z 5 miejsc: 1 spełnia, 1 nie spełnia, 3 brak danych, 0 sprzeczne.");
  await evidence("home-profile-counter");
});

test("hiding failing places drops them and announces the count", async ({ page }) => {
  // GIVEN the wheelchair profile over the sample places
  await wheelchairOverSamples(page);

  // WHEN failing places are hidden
  await page.getByRole("switch", { name: "Ukryj niespełniające" }).check();

  // THEN the barrier place disappears and the count is announced
  await expect(row(page, "Restauracja Przykład")).toHaveCount(0);
  await expect(liveRegion(page)).toHaveText("Profil: wózek. Pokazano 4 z 5 miejsc: 1 spełnia, 1 nie spełnia, 3 brak danych, 0 sprzeczne.");
});

test("an empty verdict counter blames the verdict filter, not the search", async ({ page }) => {
  // GIVEN the wheelchair profile over the sample places
  const counters = await wheelchairOverSamples(page);

  // WHEN a counter with no places is pressed
  await counters.getByRole("button", { name: "0 sprzeczne" }).click();

  // THEN the empty state blames the verdict filter, not the search, and offers only to show everything
  await expect(list(page)).toContainText("Żadne miejsce nie pasuje do wybranego wyniku");
  await expect(page.getByRole("button", { name: "Szukaj w całym Krakowie" })).toHaveCount(0);
  await page.getByRole("button", { name: "Pokaż wszystkie wyniki" }).click();
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("5 miejsc");
});

test("a profile no listed place meets says which data is missing, without passing the unknown", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the home screen narrowed to a place that has no entrance or door data
  await page.goto("/");
  await searchFor(page, "Kawiarnia Przykład");
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("1 miejsce");

  // WHEN the wheelchair profile is turned on
  await page.getByRole("radio", { name: "Wózek", exact: true }).check();

  // THEN nothing is met, and a note names the needs without data instead of showing an unexplained zero
  const counters = page.getByRole("group", { name: "Pokaż tylko miejsca z wynikiem" });
  await expect(counters.getByRole("button", { name: "0 spełnia" })).toBeVisible();
  const note = list(page).getByRole("note");
  await expect(note).toContainText("Żadne miejsce na liście nie ma jeszcze kompletu danych dla tego profilu");
  await expect(note).toContainText(/Najczęściej brakuje danych o: .*\(1 z 1\)/);
  await expect(note).toContainText("„Brak danych” nie znaczy „niedostępne”");
  await expect(row(page, "Kawiarnia Przykład")).toContainText("Brak danych");
  await expectAccessible();
  await evidence("home-profile-none-met");

  // AND the note goes away once a listed place meets the profile
  await searchFor(page, "przyk", "Hotel Przykład");
  await expect(counters.getByRole("button", { name: "1 spełnia" })).toBeVisible();
  await expect(list(page).getByRole("note")).toHaveCount(0);
});

test("switching the profile releases a pressed counter", async ({ page }) => {
  // GIVEN the wheelchair profile over the sample places with the "Spełnia" counter pressed
  const counters = await wheelchairOverSamples(page);
  await counters.getByRole("button", { name: "1 spełnia" }).click();
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("1 miejsce");

  // WHEN the profile is switched to another one
  await page.getByRole("radio", { name: "Wózek dziecięcy" }).check();

  // THEN the counter is released, because the verdicts behind it have changed
  await expect(counters.getByRole("button", { pressed: true })).toHaveCount(0);
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("5 miejsc");
});

test("thresholds change verdicts, persist in the browser and reset to defaults", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the wheelchair profile is on, over search results (the thresholds button comes with them)
  await gotoAllPlaces(page);
  await page.getByRole("radio", { name: "Wózek", exact: true }).check();
  await expect(row(page, "Hotel Przykład")).toContainText("Spełnia");

  // WHEN the user raises the minimum door width above the hotel's 90 cm
  await page.getByRole("button", { name: "Progi profilu" }).click();
  const drawer = page.getByRole("dialog", { name: "Progi profilu" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Zwiększ: Min. szerokość wejścia" }).click();
  await expect(drawer.getByRole("spinbutton", { name: "Min. szerokość wejścia" })).toHaveValue("95");
  await expect(drawer).not.toContainText(/niepełnospraw|diagnoz|choroba/i);
  await expectAccessible();
  await evidence("home-profile-thresholds");
  await drawer.getByRole("button", { name: "Gotowe" }).click();

  // THEN the hotel no longer meets the profile
  await expect(row(page, "Hotel Przykład")).toContainText("Nie spełnia · drzwi 90 cm");

  // AND the profile and thresholds survive a reload (stored only in this browser), which starts clean, so search again
  await gotoAllPlaces(page);
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
  await gotoAllPlaces(page);
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
  await done.scrollIntoViewIfNeeded();
  await expect(done).toBeInViewport({ ratio: 1 });
  await evidence("home-profile-bench");
  await done.click();

  // THEN the hotel, with no bench data, is "can't say" instead of met, and says what is missing
  await expect(row(page, "Hotel Przykład")).toContainText("Brak danych · ławka");
});

test("the senior profile is one tap away on a 360 px phone and judges places by its bench and lift needs", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the home screen on a small 360 px phone
  await page.setViewportSize({ width: 360, height: 640 });
  await gotoAllPlaces(page);
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("10 miejsc");

  // THEN every profile segment fits the switch with its label in full
  const profiles = page.getByRole("group", { name: "Profil potrzeb" });
  const labels = profiles.locator("label");
  await expect(labels).toHaveCount(4);
  for (const label of await labels.all()) {
    const text = label.locator("span");
    expect(await text.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  // WHEN the visitor picks the senior profile
  await page.getByRole("radio", { name: "Senior" }).check();

  // THEN the hotel, without bench data, can't be judged yet, and the profile is announced
  await expect(row(page, "Hotel Przykład")).toContainText("Brak danych · ławka");
  await expect(liveRegion(page)).toContainText("Profil: senior.");

  // AND the thresholds drawer opens on the senior preset: no steps, a lift and a bench, no toilet
  await page.getByRole("button", { name: "Progi profilu" }).click();
  const drawer = page.getByRole("dialog", { name: "Progi profilu" });
  await expect(drawer.getByRole("switch", { name: "Bez stopni" })).toBeChecked();
  await expect(drawer.getByRole("switch", { name: "Winda przy piętrach" })).toBeChecked();
  await expect(drawer.getByRole("switch", { name: "Ławka lub miejsce odpoczynku" })).toBeChecked();
  await expect(drawer.getByRole("switch", { name: "Toaleta dostosowana" })).not.toBeChecked();
  await drawer.getByRole("button", { name: "Gotowe" }).click();

  await expect(profiles).not.toContainText(/niepełnospraw|diagnoz|choroba/i);
  await expect(profiles).toMatchAriaSnapshot({ name: "profile-senior.aria.yml" });
  await expectAccessible();
  await evidence("home-profile-senior");
});

test("the profile switch is one row on a 360 px phone and in the desktop sidebar", async ({ page, evidence }) => {
  const rows = async () => {
    const tops = await page
      .getByRole("group", { name: "Profil potrzeb" })
      .locator("label")
      .evaluateAll((labels) => labels.map((label) => Math.round(label.getBoundingClientRect().top)));
    return new Set(tops).size;
  };

  // GIVEN the home screen on a 360 px phone
  await page.setViewportSize({ width: 360, height: 640 });
  await gotoAllPlaces(page);
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("10 miejsc");

  // THEN the four segments share one row (icons hidden to make room)
  await expect.poll(rows).toBe(1);

  // WHEN the same screen is shown on a desktop
  await page.setViewportSize({ width: 1280, height: 800 });

  // THEN the segments share one row, like the prototype's segmented control
  await expect.poll(rows).toBe(1);
  await evidence("profile-switch-desktop");
});

test("no-data and conflicting places never meet a profile; turning it off returns the neutral view", async ({ page }) => {
  // GIVEN the stroller profile, over search results listing all places
  await gotoAllPlaces(page);
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
  await gotoAllPlaces(page);
  await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
  await searchFor(page, "Hotel Przykład");
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
  const why = page.getByRole("button", { name: "Dlaczego Hotel Przykład spełnia?" });
  for (let i = 0; i < 20 && !(await why.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(why).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(row(page, "Hotel Przykład").getByRole("heading", { name: "Pasuje (4)" })).toBeVisible();

  // AND Space closes it again, staying on the home screen
  await page.keyboard.press("Space");
  await expect(row(page, "Hotel Przykład").getByRole("heading", { name: "Pasuje (4)" })).toBeHidden();
  await expect(page).toHaveURL(/\/(\?.*)?$/);
});

test("the old /profil page is gone", async ({ page }) => {
  // GIVEN the profile now lives on the home screen
  // WHEN someone opens the old address
  const response = await page.goto("/profil");
  // THEN it does not exist
  expect(response?.status()).toBe(404);
});
