import { expect, test } from "./fixtures";
import { showResults } from "./map";

test("a category chip toggles: a tap turns it on, a second tap goes back to every category", async ({ page }) => {
  // GIVEN the home screen at its start, with no "all" chip and no category pressed
  await page.goto("/");
  const list = page.getByRole("region", { name: "Lista miejsc" });
  const chips = page.getByRole("group", { name: "Kategorie" });
  const museums = chips.getByRole("button", { name: "Muzea" });
  await expect(museums).toHaveAttribute("aria-pressed", "false");
  await expect(chips.getByRole("button", { name: "Wszystko" })).toHaveCount(0);

  // WHEN the visitor taps "Muzea" and confirms
  await museums.click();
  await showResults(page);

  // THEN only museums are listed
  await expect(museums).toHaveAttribute("aria-pressed", "true");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("4 miejsca");

  // WHEN they tap it again
  await museums.click();

  // THEN no category is chosen and the change is announced
  await expect(museums).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("status").filter({ hasText: "Pokazuję wszystkie kategorie" })).toBeAttached();

  // WHEN they confirm the empty choice
  await page.getByRole("button", { name: "Wyczyść wybór i wróć do mapy" }).click();

  // THEN the start state is back
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("Najbliżej Rynku (bez lokalizacji)");
});

for (const key of ["Enter", " "]) {
  test(`a category chip toggles with ${key === " " ? "Space" : key} too`, async ({ page }) => {
    // GIVEN the home screen and a keyboard user on the "Muzea" chip
    await page.goto("/");
    const museums = page.getByRole("group", { name: "Kategorie" }).getByRole("button", { name: "Muzea" });
    await museums.focus();

    // WHEN they press the key twice
    await page.keyboard.press(key);
    await expect(museums).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press(key);

    // THEN the chip is on after the first press and off after the second
    await expect(museums).toHaveAttribute("aria-pressed", "false");
  });
}
