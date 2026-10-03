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

  // WHEN a visitor opens its card and presses "Zgłoś awarię" at the lift, keyboard only
  await hotelRow(page).getByRole("link", { name: /Hotel Przykład/ }).click();
  const report = page.getByRole("button", { name: "Zgłoś awarię windy" });
  await report.focus();
  await page.keyboard.press("Enter");

  // AND confirms in the sheet that asks first (the lift is known, so no "Brak danych" warning)
  const sheet = page.getByRole("dialog", { name: "Winda nie działa?" });
  await expect(sheet.getByRole("button", { name: "Zgłoś awarię windy" })).toBeFocused();
  await expect(sheet).not.toContainText("Nie mamy danych");
  await page.keyboard.press("Enter");
  const outages = page.getByRole("region", { name: "Zgłoszone awarie" });

  // THEN the card shows the unverified outage at once, focus moves to it, and the lift can't be reported twice
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

test("an outage of a lift with no data warns that we don't know it exists, and cancel saves nothing", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a place whose lift is "Brak danych"
  await page.goto("/miejsca/palac-krzysztofory");

  // WHEN the visitor taps "Zgłoś awarię" at the lift
  const report = page.getByRole("button", { name: "Zgłoś awarię windy" });
  await report.click();

  // THEN nothing is saved yet: the sheet asks first and says we don't know whether there is a lift
  const sheet = page.getByRole("dialog", { name: "Winda nie działa?" });
  await expect(sheet).toContainText("Nie mamy danych, czy jest tu winda. Zgłoś awarię tylko, jeśli ją widzisz i nie działa.");
  await expect(sheet).toMatchAriaSnapshot({ name: "place-outage-confirm.aria.yml" });
  await expectAccessible();
  await evidence("place-outage-confirm");
  const outages = page.getByRole("region", { name: "Zgłoszone awarie" });

  // WHEN they cancel with Escape, then with "Anuluj"
  await page.keyboard.press("Escape");

  // THEN focus is back on "Zgłoś awarię" and no outage was saved either way
  await expect(sheet).toHaveCount(0);
  await expect(report).toBeFocused();
  await page.keyboard.press("Enter");
  await sheet.getByRole("button", { name: "Anuluj" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(outages).toHaveCount(0);
  await expect(report).toBeVisible();
});
