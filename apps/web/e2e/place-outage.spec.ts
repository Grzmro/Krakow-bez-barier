import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Outages go to the in-browser mock (example-data mode); it keeps them for the page's lifetime, so the spec moves
// between the list and the card with client-side navigation only.

const list = (page: Page) => page.getByRole("region", { name: "Lista miejsc" });
const hotelRow = (page: Page) =>
  list(page).getByRole("listitem").filter({ has: page.getByRole("link", { name: /Hotel Przykład/ }) });

test("a reported lift outage shows on the card and blocks the profile verdict until someone says it works", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the wheelchair profile, under which Hotel Przykład meets every need
  await page.goto("/");
  await page.getByRole("radio", { name: "Wózek", exact: true }).check();
  await expect(hotelRow(page)).toContainText("Spełnia · niepotwierdzone");

  // WHEN a visitor opens its card and reports the lift broken, keyboard only
  await hotelRow(page).getByRole("link", { name: /Hotel Przykład/ }).click();
  const report = page.getByRole("button", { name: "Zgłoś awarię windy" });
  await report.focus();
  await page.keyboard.press("Enter");

  // THEN the card shows the unverified outage at once, focus moves to it, and the lift can't be reported twice
  const outages = page.getByRole("region", { name: "Zgłoszone awarie" });
  await expect(outages).toBeFocused();
  await expect(outages).toContainText("Zgłoszona awaria windy · 0 potwierdzeń · teraz");
  await expect(outages).toContainText("Niezweryfikowane");
  await expect(outages).toContainText("Zgłoszenie odwiedzających, bez moderacji.");
  await expect(outages).toContainText("Zniknie za 48 godz., jeśli nikt jej nie potwierdzi.");
  await expect(report).toHaveCount(0);
  await expect(page.locator("[data-sonner-toast]").getByText("Dzięki! Awaria jest widoczna dla innych.")).toBeVisible();
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "place-outage.aria.yml" });
  // Sonner's exit animation fades the toast text, which axe would flag as low contrast.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await expectAccessible();
  await evidence("place-outage");

  // AND the list verdict counts it as an unconfirmed barrier
  await page.goBack();
  await expect(hotelRow(page)).toContainText("Nie spełnia · zgłoszona awaria windy · niepotwierdzone");
  await evidence("place-outage-verdict");

  // WHEN another visitor confirms it, then someone reports that it works again
  await hotelRow(page).getByRole("link", { name: /Hotel Przykład/ }).click();
  await outages.getByRole("button", { name: "Potwierdzam awarię" }).click();
  await expect(outages).toContainText("Zgłoszona awaria windy · 1 potwierdzenie");
  await expect(outages.getByRole("button", { name: "Działa" })).toBeFocused();
  await page.keyboard.press("Enter");

  // THEN the outage is off the card, focus lands on the facts, and the hotel meets the profile again
  await expect(outages).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Fakty" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Zgłoś awarię windy" })).toBeVisible();
  await page.goBack();
  await expect(hotelRow(page)).toContainText("Spełnia · niepotwierdzone");
});
