import { expect, test } from "./fixtures";
import { placesOnMap } from "./map";

test("search for Sukiennice shows it on the list and the map and opens its card", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the home screen with every sample place
  await page.goto("/");
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-screen.aria.yml" });
  await expectAccessible();
  await evidence("home-screen");

  // WHEN the visitor types "Sukiennice"
  await page.getByRole("combobox", { name: "Wyszukaj miejsce" }).fill("Sukiennice");

  // THEN one result is listed, announced, and pinned on the map
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("1 miejsce");
  await expect(page.getByRole("status").filter({ hasText: "Znaleziono 1 miejsce" })).toBeAttached();
  const row = list.getByRole("link", { name: /Sukiennice/ });
  await expect(row).toContainText("Wejście bez stopni · Winda · Toaleta: brak danych");
  await expect(row).toContainText("od Rynku");
  await expect(page.locator('[data-place-id="sukiennice"]')).toHaveCount(1);
  await expect(page.locator("[data-place-id]")).toHaveCount(1);
  await evidence("home-search-sukiennice");

  // WHEN they open the result
  await row.click();

  // THEN its place card opens
  await expect(page).toHaveURL(/\/miejsca\/sukiennice$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sukiennice" })).toBeVisible();
});

test("feature filter hides places without data until the switch shows them as Brak danych", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the home screen
  await page.goto("/");
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");

  // WHEN the visitor turns on the "Winda" filter (no profile)
  await page.getByRole("button", { name: "Winda", exact: true }).click();

  // THEN only places with a known lift remain and none is marked as missing data
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("2 miejsca");
  await expect(list.getByRole("link", { name: /Pałac Krzysztofory/ })).toHaveCount(0);
  await expect(list.getByText("Brak danych", { exact: true })).toHaveCount(0);

  // WHEN they switch on "Pokaż też miejsca bez danych"
  await page.getByRole("switch", { name: "Pokaż też miejsca bez danych" }).click();

  // THEN places without lift data come back, labeled "Brak danych"
  const palace = list.getByRole("link", { name: /Pałac Krzysztofory/ });
  await expect(palace).toBeVisible();
  await expect(palace.getByText("Brak danych", { exact: true })).toBeVisible();
  const rows = await list.getByRole("listitem").count();
  await expect.poll(() => placesOnMap(page)).toBe(rows);
  await expectAccessible();
  await evidence("home-filter-show-unknown");
});

test("no results offers a wider search", async ({ page, evidence }) => {
  // GIVEN the home screen
  await page.goto("/");

  // WHEN the search matches nothing
  await page.getByRole("combobox", { name: "Wyszukaj miejsce" }).fill("Zzzz");

  // THEN the empty state explains it and the wider search restores all places
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByText("Brak miejsc dla tego wyszukiwania.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Nie znaleziono miejsc" })).toBeAttached();
  await evidence("home-empty");
  await list.getByRole("button", { name: "Szukaj w całym Krakowie" }).click();
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
});

test("on a 390x844 phone the skip link jumps past the map to the list, below the sticky header", async ({
  page,
  evidence,
}) => {
  // GIVEN the home screen on a small phone, under the sticky app header
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  const header = (await page.locator("header").boundingBox())!;
  const searchBox = (await page.getByRole("combobox", { name: "Wyszukaj miejsce" }).boundingBox())!;
  expect(searchBox.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);

  // WHEN a keyboard user tabs to "Przejdź do listy" and follows it
  const skip = page.getByRole("link", { name: "Przejdź do listy" });
  for (let i = 0; i < 10 && !(await skip.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await evidence("home-skip-to-list");
  await page.keyboard.press("Enter");

  // THEN the list has focus and the next Tab lands on the first place, in view
  await expect(page.locator("#lista")).toBeFocused();
  await page.keyboard.press("Tab");
  const firstRow = list.getByRole("link").first();
  await expect(firstRow).toBeFocused();
  await expect(firstRow).toBeInViewport();
});

test("the whole flow works with the keyboard alone", async ({ page }) => {
  // GIVEN the home screen
  await page.goto("/");
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");

  // WHEN a keyboard user tabs to the search field and types
  const search = page.getByRole("combobox", { name: "Wyszukaj miejsce" });
  while (!(await search.evaluate((el) => el === document.activeElement))) await page.keyboard.press("Tab");
  await page.keyboard.type("Hotel");

  // THEN a suggestion appears and can be picked with the arrow keys
  await expect(page.getByRole("option", { name: "Hotel Przykład" })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(search).toHaveValue("Hotel Przykład");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("1 miejsce");

  // WHEN they pick a category with the keyboard (arrow keys move inside the group)
  await page.getByRole("button", { name: "Wyczyść wyszukiwanie" }).press("Enter");
  await page.getByRole("button", { name: "Wszystko" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Muzea" })).toHaveAttribute("aria-pressed", "true");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("3 miejsca");

  // AND the map zooms with its buttons and the list rows are reachable by Tab
  await page.getByRole("button", { name: "Przybliż" }).press("Enter");
  const firstRow = list.getByRole("link").first();
  while (!(await firstRow.evaluate((el) => el === document.activeElement))) await page.keyboard.press("Tab");
  await expect(firstRow).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/miejsca\//);
});

test("category chips are rendered from the categories API response, including ones web code never names", async ({ page }) => {
  // GIVEN the home screen on the mock API (its categories response is kept equal to the config by a contracts test)
  // WHEN it loads
  await page.goto("/");

  // THEN the filter offers Apteki, which no web code names
  const chips = page.getByRole("group", { name: "Kategorie" });
  await expect(chips.getByRole("button", { name: "Apteki" })).toBeVisible();
  await expect(chips.getByRole("button", { name: "Muzea" })).toBeVisible();
});

test("a feature filter nobody described here says it is missing data, not the facility", async ({ page, evidence }) => {
  // GIVEN the home screen searched down to one place
  await page.goto("/");
  await page.getByRole("combobox", { name: "Wyszukaj miejsce" }).fill("Sukiennice");
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("1 miejsce");

  // WHEN a feature filter no listed place has in its data is turned on
  await page.getByRole("button", { name: "Parking N", exact: true }).click();

  // THEN the empty state says the data is missing and offers to show the places without it
  await expect(list.getByText("Brak miejsc dla tego wyszukiwania.")).toBeVisible();
  await expect(list).toContainText("Żadne miejsce w wynikach nie ma w danych: Parking N.");
  await expect(list).toContainText("brak danych to nie brak udogodnienia");
  await evidence("home-feature-no-data");
  await list.getByRole("button", { name: "Pokaż też miejsca bez danych" }).click();
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("1 miejsce");
});
