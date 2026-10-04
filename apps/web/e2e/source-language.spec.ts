import { expect, test } from "./fixtures";

// Source texts (names, licences, attributions) come untranslated from the source registry; on the English page they
// carry lang="pl" (WCAG 3.1.2), while statuses we own are translated. Sources come from the mock API, departures
// from the recorded ZTP feed.

test.beforeEach(async ({ page }) => {
  // GIVEN a visitor who chose English before
  await page.goto("/");
  await page.evaluate(() => (document.cookie = "kbb-lang=en; path=/"));
});

test("the data sources page marks a Polish source name lang=pl, not the English OSM attribution", async ({ page }) => {
  // WHEN the data sources page is opened
  await page.goto("/o-danych");

  // THEN the Polish source name is marked Polish and the English attribution is left in the page language
  const main = page.locator("main");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(main.getByRole("heading", { level: 3, name: "MSIP: Toalety publiczne" }).locator('[lang="pl"]')).toBeVisible();
  await expect(main.getByText("© OpenStreetMap contributors").first()).toBeVisible();
  await expect(main.locator('[lang="pl"]', { hasText: "© OpenStreetMap contributors" })).toHaveCount(0);
});

test("the departures' licence status is translated and the feed name marked Polish", async ({ page }) => {
  // WHEN a place card with departures is opened
  await page.goto("/miejsca/palac-krzysztofory");
  const transit = page.getByRole("region", { name: "Nearest departures" });

  // THEN the operator's feed name is marked Polish and the licence status is our English wording, unmarked
  await expect(transit.locator('[lang="pl"]', { hasText: "ZTP Kraków: GTFS i GTFS-Realtime" })).toBeVisible();
  await expect(transit).toContainText("licence: to be confirmed with the city");
  await expect(transit.locator('[lang="pl"]', { hasText: "to be confirmed" })).toHaveCount(0);
});
