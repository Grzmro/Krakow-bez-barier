import { expect, test } from "./fixtures";

// The default project emulates a phone; these specs look at the place card as a laptop or monitor does.
test.use({ isMobile: false, hasTouch: false });

const WIDTHS = [1280, 1440, 1920];

for (const width of WIDTHS) {
  test(`at ${width}px facts and sources sit side by side instead of one narrow column`, async ({ page }) => {
    // GIVEN the card of a place with conflicting data, in a desktop window
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/miejsca/palac-krzysztofory");
    const facts = page.getByRole("region", { name: "Fakty" });
    const sources = page.getByRole("region", { name: "Skąd wiemy?" });
    await expect(facts).toBeVisible();
    await expect(sources).toBeVisible();

    // THEN the facts are on the left, the sources on the right at the same height, and the content uses the width
    const f = (await facts.boundingBox())!;
    const s = (await sources.boundingBox())!;
    expect(f.x + f.width).toBeLessThanOrEqual(s.x);
    expect(Math.abs(f.y - s.y)).toBeLessThanOrEqual(8);
    expect(s.x + s.width - f.x).toBeGreaterThan(900);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}

test("a conflict shows both values with their sources and dates side by side, never as accessible", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the card at 1440 px where OSM says the toilet is missing and the city says it is there
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/miejsca/palac-krzysztofory");
  const table = page.getByRole("table", { name: "Porównanie źródeł" });

  // THEN the comparison table lists both sources with their values and dates
  await expect(table).toBeVisible();
  await expect(table.getByRole("row", { name: /MSIP: Toalety publiczne.*Jest.*8\.11\.2023/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /OpenStreetMap.*Nie ma/ })).toBeVisible();

  // AND the fact row says "Sprzeczne" with both values, and no source's value stands in for the answer
  const toilet = page.getByRole("listitem").filter({ hasText: "Toaleta dostosowana" });
  await expect(toilet).toContainText("Sprzeczne");
  await expect(toilet).toContainText("Jest / Nie ma");

  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "place-desktop.aria.yml" });
  await expectAccessible();
  await evidence("place-desktop");
});

test("missing data stays 'Brak danych' and the sample label stays visible on desktop", async ({ page }) => {
  // GIVEN the card of a sample place at 1440 px
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/miejsca/palac-krzysztofory");

  // THEN unknown attributes are named as missing and the place is still labelled as sample data
  const threshold = page.getByRole("listitem").filter({ hasText: "Próg" });
  await expect(threshold).toContainText("Brak danych");
  await expect(page.getByText("PRZYKŁAD").first()).toBeVisible();
});

test("the small map is drawn and named for where the place is, not for a list", async ({ page }) => {
  // GIVEN the card at 1440 px
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/miejsca/palac-krzysztofory");

  // THEN a map canvas is shown with a pin, and its name says it shows this place's location
  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("aria-label", /położeniem miejsca/);
  await expect(page.locator("[data-place-id]")).toHaveCount(1);
});

test("a place without conflicting data has no comparison table, and the sources still sit beside the facts", async ({ page }) => {
  // GIVEN the card of a place whose sources agree, at 1440 px
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/miejsca/sukiennice");
  const facts = page.getByRole("region", { name: "Fakty" });
  const sources = page.getByRole("region", { name: "Skąd wiemy?" });
  await expect(facts).toBeVisible();

  // THEN there is no comparison table and the two columns are still side by side
  await expect(page.getByRole("table")).toHaveCount(0);
  const f = (await facts.boundingBox())!;
  const s = (await sources.boundingBox())!;
  expect(f.x + f.width).toBeLessThanOrEqual(s.x);
});

test("on a phone the card is unchanged: no comparison table and no map", async ({ page }) => {
  // GIVEN the card in the default phone viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/miejsca/palac-krzysztofory");
  await expect(page.getByRole("heading", { level: 1, name: "Pałac Krzysztofory" })).toBeVisible();

  // THEN there is neither the comparison table nor a map
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
});
