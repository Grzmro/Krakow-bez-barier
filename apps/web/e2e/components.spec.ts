import { expect, test } from "@playwright/test";

test("component preview shows every status as text and works from the keyboard", async ({ page }) => {
  // GIVEN the component preview page
  await page.goto("/dev/components");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Podgląd komponentów");

  // THEN every status and reliability word is visible as text
  for (const word of ["Spełnia", "Nie spełnia", "Sprzeczne", "Brak danych"]) {
    await expect(page.getByText(word, { exact: true }).first()).toBeVisible();
  }
  for (const word of ["Potwierdzone", "Niezweryfikowane", "Nieaktualne"]) {
    await expect(page.getByText(word, { exact: true }).first()).toBeVisible();
  }

  // WHEN a keyboard user expands a fact row
  const door = page.getByRole("button", { name: /Drzwi/ });
  await door.focus();
  await page.keyboard.press("Enter");

  // THEN its source and date are revealed
  await expect(door).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Pozyskano 4.05.2021 · 2/2 potwierdzeń")).toBeVisible();

  // WHEN they toggle the bottom panel with the keyboard
  const grabber = page.getByRole("button", { name: "Rozwiń arkusz" });
  await grabber.focus();
  await page.keyboard.press("Space");

  // THEN it expands without a drag gesture
  await expect(page.getByRole("button", { name: "Zwiń arkusz" })).toHaveAttribute("aria-expanded", "true");

  // WHEN they ask for an announcement
  await page.getByRole("button", { name: "Ogłoś wynik" }).click();

  // THEN the app-wide live region speaks it
  await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveText("Znaleziono 12 miejsc");

  await page.screenshot({ path: "test-results/components.png", fullPage: true });
});

test("menu opens as a dialog with the extra pages and closes with Escape", async ({ page }) => {
  // GIVEN any page
  await page.goto("/");

  // WHEN the menu button is activated from the keyboard
  const menu = page.getByRole("button", { name: "Menu" });
  await menu.focus();
  await page.keyboard.press("Enter");

  // THEN a dialog lists the extra pages
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: /O danych/ })).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Deklaracja dostępności/ })).toBeVisible();

  // WHEN Escape is pressed
  await page.keyboard.press("Escape");

  // THEN the dialog closes and focus returns to the menu button
  await expect(dialog).toBeHidden();
  await expect(menu).toBeFocused();
});
