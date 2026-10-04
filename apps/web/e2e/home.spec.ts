import { expect, test } from "./fixtures";
import { placesOnMap, gotoAllPlaces, searchFor, showResults } from "./map";

test("the start is a clean map with a peek of the nearest places that a search replaces with results and pins", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the home screen just opened, without a location
  await page.goto("/");
  const list = page.getByRole("region", { name: "Lista miejsc" });

  // THEN the map has no pins, and a partly slid out panel peeks the five nearest places, not the full list
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("Najbliżej Rynku (bez lokalizacji)");
  const rows = list.locator("#lista > ul > li");
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText("od Rynku");
  await expect(page.locator("[data-place-id], [data-cluster-count]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Informacje o źródłach mapy" })).toBeVisible();
  const viewport = page.viewportSize()!;
  await expect.poll(async () => (await list.boundingBox())!.height).toBeLessThan(viewport.height * 0.4);
  await expect(page.getByRole("status").filter({ hasText: "Znaleziono" })).toHaveCount(0);
  await expectAccessible();
  await evidence("home-start-peek");

  // WHEN the visitor expands the panel with its button
  await list.getByRole("button", { name: "Rozwiń arkusz" }).click();

  // THEN it grows (still no pins)
  await expect(list.getByRole("button", { name: "Zwiń arkusz" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-place-id], [data-cluster-count]")).toHaveCount(0);

  // WHEN they search
  const search = page.getByRole("combobox", { name: "Wyszukaj miejsce" });
  await search.fill("Sukiennice");

  // THEN nothing is listed until Enter (typing only suggests)
  await expect(page.locator("[data-place-id]")).toHaveCount(0);
  await search.press("Enter");

  // AND the results are listed and pinned, and a row opens the place
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("1 miejsce");
  await expect(page.locator("[data-place-id]")).toHaveCount(1);

  // WHEN they clear the search
  await page.getByRole("button", { name: "Wyczyść wyszukiwanie" }).click();

  // THEN the clean map and the peek are back
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("Najbliżej Rynku (bez lokalizacji)");
  await expect(rows).toHaveCount(5);
  await expect(page.locator("[data-place-id], [data-cluster-count]")).toHaveCount(0);
});

test("search for Sukiennice shows it on the list and the map and opens its card", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the home screen with every sample place
  await gotoAllPlaces(page);
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-screen.aria.yml" });
  await expectAccessible();
  await evidence("home-screen");

  // WHEN the visitor types "Sukiennice"
  await searchFor(page, "Sukiennice");

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
  await gotoAllPlaces(page);
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("10 miejsc");

  // WHEN the visitor turns on the "Winda" filter (no profile)
  await page.getByRole("button", { name: "Winda", exact: true }).click();
  await showResults(page);

  // THEN only places with a known lift remain and none is marked as missing data
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("3 miejsca");
  await expect(list.getByRole("link", { name: /Pałac Krzysztofory/ })).toHaveCount(0);
  await expect(list.getByText("Brak danych", { exact: true })).toHaveCount(0);

  // WHEN they switch on "Pokaż też miejsca bez danych"
  await page.getByRole("switch", { name: "Pokaż też miejsca bez danych" }).click();
  await showResults(page);

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
  await searchFor(page, "Zzzz");

  // THEN the empty state explains it and the wider search clears the search
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByText("Brak miejsc dla tego wyszukiwania.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Nie znaleziono miejsc" })).toBeAttached();
  await evidence("home-empty");
  await list.getByRole("button", { name: "Szukaj w całym Krakowie" }).click();
  await expect(list.getByText("Brak miejsc dla tego wyszukiwania.")).toBeHidden();
  await expect(page.getByRole("combobox", { name: "Wyszukaj miejsce" })).toHaveValue("");
});

test("on a 390x844 phone the skip link jumps past the map to the list, below the sticky header", async ({
  page,
  evidence,
}) => {
  // GIVEN the home screen on a small phone, under the sticky app header
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAllPlaces(page);
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
  const header = (await page.locator("header").boundingBox())!;
  const searchBox = (await page.getByRole("combobox", { name: "Wyszukaj miejsce" }).boundingBox())!;
  expect(searchBox.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);

  // WHEN a keyboard user tabs to "Przejdź do listy" and follows it
  const skip = page.getByRole("link", { name: "Przejdź do listy" });
  // The search above left Tab's starting point in the field; start from the top of <main>, as on arrival.
  await page.locator("main").focus();
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
  // Search, category, map and a place card, one key at a time: more than the 15 s budget on a loaded machine.
  test.setTimeout(30_000);
  // GIVEN the home screen at its start
  await page.goto("/");
  const list = page.getByRole("region", { name: "Lista miejsc" });

  // WHEN a keyboard user tabs to the search field and types
  const search = page.getByRole("combobox", { name: "Wyszukaj miejsce" });
  while (!(await search.evaluate((el) => el === document.activeElement))) await page.keyboard.press("Tab");
  await page.keyboard.type("Hotel");

  // THEN a suggestion appears and can be picked with the arrow keys
  await expect(page.getByRole("option", { name: "Hotel Przykład" })).toBeVisible();
  // (the category "Hotele" is suggested first, the place after it)
  await page.keyboard.press("ArrowDown");
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
  await page.getByRole("button", { name: /^Pokaż wyniki/ }).press("Enter");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("4 miejsca");

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
  await searchFor(page, "Sukiennice");
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("1 miejsce");

  // WHEN a feature filter no listed place has in its data is turned on
  await page.getByRole("button", { name: "Parking dla OzN", exact: true }).click();
  await showResults(page);

  // THEN the empty state says the data is missing and offers to show the places without it
  await expect(list.getByText("Brak miejsc dla tego wyszukiwania.")).toBeVisible();
  await expect(list).toContainText("Żadne miejsce w wynikach nie ma w danych: Parking dla OzN.");
  await expect(list).toContainText("brak danych to nie brak udogodnienia");
  await evidence("home-feature-no-data");
  await list.getByRole("button", { name: "Pokaż też miejsca bez danych" }).click();
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("1 miejsce");
});
