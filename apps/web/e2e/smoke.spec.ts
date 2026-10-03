import { expect, test } from "./fixtures";

test("home page loads in Polish, has the expected structure and passes axe", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a fresh visitor
  // WHEN they open the home page
  await page.goto("/");

  // THEN the app title, language and PRZYKŁAD banner are there
  await expect(page).toHaveTitle("Kraków bez barier");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.getByRole("note")).toContainText("PRZYKŁAD");
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home.aria.yml" });

  // AND the page has no WCAG 2.2 AA violations axe can detect
  await expectAccessible();
  await evidence("home");
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
