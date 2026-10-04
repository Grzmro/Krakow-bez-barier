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

test("the widget marks a Polish source name on a fact row lang=pl", async ({ page }) => {
  // WHEN the demo hotel's widget is opened
  await page.goto("/widget/hotel-przyklad");
  const facts = page.getByRole("list", { name: "Accessibility features" });

  // THEN the venue's own source name is marked Polish, OpenStreetMap is left alone
  await expect(facts.locator('[lang="pl"]', { hasText: "Dane obiektu" }).first()).toBeVisible();
  await expect(facts.getByText(/OpenStreetMap/).first()).toBeVisible();
  await expect(facts.locator('[lang="pl"]', { hasText: "OpenStreetMap" })).toHaveCount(0);
});

test("the event page marks the Polish source names of its facts lang=pl", async ({ page }) => {
  // WHEN the event page of the demo hotel is opened
  await page.goto("/wydarzenie/hotel-przyklad");

  // THEN a fact's source line carries the venue's own source name marked Polish
  const entrance = page.getByRole("list", { name: "Entrance" });
  await expect(entrance.locator('[lang="pl"]', { hasText: "Dane obiektu" }).first()).toBeVisible();
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
