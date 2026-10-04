import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { gotoAllPlaces, showResults } from "./map";

const list = (page: Page) => page.getByRole("region", { name: "Lista miejsc" });

for (const width of [360, 390]) {
  test(`verdict and status badges are never clipped at ${width} px`, async ({ page, expectAccessible, evidence }) => {
    // GIVEN a phone-width screen with the sample places and a filter that adds status badges
    await page.setViewportSize({ width, height: 800 });
    await gotoAllPlaces(page);
    await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
    const search = page.getByRole("combobox", { name: "Wyszukaj miejsce" });
    await search.fill("przyk");
    // Wait for the debounced place names, so Escape closes a settled popup (on a closed one it clears the field).
    await expect(page.getByRole("option", { name: "Hotel Przykład" })).toBeVisible();
    await search.press("Escape");
    await expect(search).toHaveAttribute("aria-expanded", "false");
    await search.press("Enter");
    await expect(list(page).getByRole("heading", { level: 2 })).toHaveText("5 miejsc");
    await page.getByRole("button", { name: "Toaleta dostosowana", exact: true }).click();
    await page.getByRole("switch", { name: "Pokaż też miejsca bez danych" }).click();
    await showResults(page);

    // WHEN the wheelchair profile gives every place a verdict
    await page.getByRole("radio", { name: "Wózek", exact: true }).check();
    const hotel = list(page).getByRole("listitem").filter({ hasText: "Hotel Przykład" });
    await expect(hotel).toContainText("Spełnia · niepotwierdzone");

    // THEN every badge shows its full text inside its row
    const badges = list(page).locator("[data-status]");
    expect(await badges.count()).toBeGreaterThan(5);
    for (const badge of await badges.all()) {
      const fit = await badge.evaluate((el) => {
        const row = el.closest("li")!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        return {
          text: el.textContent,
          clipped: el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight,
          inside: box.left >= row.left && box.right <= row.right,
        };
      });
      expect(fit, `badge "${fit.text}"`).toEqual({ text: fit.text, clipped: false, inside: true });
    }
    await page.getByRole("button", { name: "Rozwiń arkusz" }).click();
    await hotel.scrollIntoViewIfNeeded();
    await expect(hotel.getByText("Spełnia · niepotwierdzone")).toBeVisible();
    await expectAccessible();
    await evidence(`home-profile-${width}`);
  });
}
