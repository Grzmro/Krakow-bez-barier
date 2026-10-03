import { expect, test } from "./fixtures";

const liveRegion = (page: import("@playwright/test").Page) => page.locator('div[role="status"][aria-atomic="true"]');
const row = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });

test("wheelchair profile shows verdicts, announces counts and keeps the search", async ({ page, expectAccessible, evidence }) => {
  // GIVEN a visitor who searched for the sample places
  await page.goto("/profil");
  const search = page.getByRole("searchbox", { name: "Szukaj miejsca" });
  await search.fill("przyk");
  await expect(page.getByRole("heading", { name: /Miejsca · 5 miejsc/ })).toBeVisible();
  await expect(page.getByText("Spełnia")).toHaveCount(0);

  // WHEN they turn on the wheelchair profile with one click
  await page.getByRole("radio", { name: "Wózek", exact: true }).check();

  // THEN every place gets a verdict, without a reload and without losing the search
  await expect(search).toHaveValue("przyk");
  await expect(row(page, "Hotel Przykład")).toContainText("Spełnia · niepotwierdzone");
  await expect(row(page, "Restauracja Przykład")).toContainText("Nie spełnia · 2 stopnie");
  await expect(row(page, "Kawiarnia Przykład")).toContainText("Brak danych");
  await expect(liveRegion(page)).toHaveText(
    "Profil: wózek. 5 miejsc: 1 spełnia, 1 nie spełnia, 3 brak danych, 0 sprzeczne.",
  );

  // AND hiding failing places announces the new count
  await page.getByRole("switch", { name: "Ukryj niespełniające" }).check();
  await expect(row(page, "Restauracja Przykład")).toHaveCount(0);
  await expect(liveRegion(page)).toHaveText(
    "Profil: wózek. 4 miejsca (ukryto niespełniające: 1): 1 spełnia, 0 nie spełnia, 3 brak danych, 0 sprzeczne.",
  );

  // AND the card groups explain the verdict
  await row(page, "Hotel Przykład").getByRole("button", { name: "Dlaczego?" }).click();
  await expect(row(page, "Hotel Przykład").getByRole("heading", { name: "Pasuje (4)" })).toBeVisible();

  // AND nothing on the page asks about a disability
  await expect(page.locator("main")).not.toContainText(/niepełnospraw|diagnoz|choroba/i);
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "profile.aria.yml" });
  await expectAccessible();
  await evidence("profile");
});

test("thresholds change verdicts, persist in the browser and reset to defaults", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the wheelchair profile is on
  await page.goto("/profil");
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
  await evidence("profile-thresholds");
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

test("no-data and conflicting places never meet a profile; turning it off returns the neutral view", async ({ page }) => {
  // GIVEN the stroller profile
  await page.goto("/profil");
  await page.getByRole("radio", { name: "Wózek dziecięcy" }).check();

  // THEN the incomplete and conflicting demo places are not "Spełnia"
  await expect(row(page, "Kawiarnia Przykład")).toContainText("Brak danych");
  await expect(row(page, "Pałac Krzysztofory")).not.toContainText("Spełnia");

  // WHEN the profile is turned off with one click
  await page.getByRole("radio", { name: "Profil wyłączony, widok dla każdego" }).check();

  // THEN verdicts disappear and the change is announced
  await expect(page.locator("main [data-status]")).toHaveCount(0);
  await expect(liveRegion(page)).toContainText("Profil wyłączony. Widok dla każdego");
});

test("profile switch works from the keyboard", async ({ page }) => {
  // GIVEN the home page
  await page.goto("/profil");
  await page.getByRole("searchbox", { name: "Szukaj miejsca" }).focus();

  // WHEN a keyboard user tabs into the profile group and presses the arrow key
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: "Profil wyłączony, widok dla każdego" })).toBeFocused();
  await page.keyboard.press("ArrowRight");

  // THEN the wheelchair profile is selected and verdicts appear
  await expect(page.getByRole("radio", { name: "Wózek", exact: true })).toBeChecked();
  await expect(row(page, "Hotel Przykład")).toContainText("Spełnia");
});
