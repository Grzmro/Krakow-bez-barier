import { expect, test } from "@playwright/test";

test("home page loads in Polish with the sample-data banner", async ({ page }) => {
  // GIVEN a fresh visitor
  // WHEN they open the home page
  await page.goto("/");

  // THEN the app title, language and PRZYKŁAD banner are there
  await expect(page).toHaveTitle("Kraków bez barier");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kraków bez barier");
  await expect(page.getByRole("note")).toContainText("PRZYKŁAD");
});

test("skip link is the first tab stop and moves focus to main content", async ({ page }) => {
  // GIVEN the home page
  await page.goto("/");

  // WHEN a keyboard user presses Tab and activates the first link
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Przejdź do treści" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");

  // THEN focus lands on the main region
  await expect(page.locator("main#main")).toBeFocused();
});
