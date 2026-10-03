import { expect, test } from "./fixtures";

test("a narrowed map has a back button and the logo, both returning to the whole map", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the home screen with every sample place and no back button
  await page.goto("/");
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  const back = page.getByRole("button", { name: "Wróć do całej mapy" });
  await expect(back).toHaveCount(0);

  // WHEN the visitor narrows the map to museums
  await page.getByRole("button", { name: "Muzea" }).click();

  // THEN a back button appears next to the search field
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("3 miejsca");
  await expect(back).toBeVisible();
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-narrowed.aria.yml" });
  await expectAccessible();
  await evidence("home-narrowed-back");

  // WHEN a keyboard user presses it
  await back.press("Enter");

  // THEN every place is back, the button is gone and focus lands on the search field
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  await expect(page.getByRole("button", { name: "Wszystko" })).toHaveAttribute("aria-pressed", "true");
  await expect(back).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Wyszukaj miejsce" })).toBeFocused();

  // WHEN they narrow the map again with a search and press the logo
  await page.getByRole("combobox", { name: "Wyszukaj miejsce" }).fill("Sukiennice");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("1 miejsce");
  await page.getByRole("link", { name: "Kraków bez barier — strona główna" }).click();

  // THEN the logo also returns to the whole map, on the same page
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  await expect(page.getByRole("combobox", { name: "Wyszukaj miejsce" })).toHaveValue("");
  await expect(page).toHaveURL(/\/$/);
});

test("the place card's back button returns to the list, or to the home screen from a shared link", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a place opened from the home screen's list
  await page.goto("/");
  await page.getByRole("region", { name: "Lista miejsc" }).getByRole("link", { name: /Sukiennice/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sukiennice" })).toBeVisible();
  const back = page.getByRole("link", { name: "Wstecz" });
  await expect(back).toBeVisible();
  await expectAccessible();
  await evidence("place-back");

  // WHEN a keyboard user presses "Wstecz"
  await back.press("Enter");

  // THEN they are back on the home screen
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mapa i lista miejsc" })).toBeAttached();

  // GIVEN a place opened straight from a shared link, with no app history behind it
  await page.goto("/miejsca/sukiennice");
  await expect(page.getByRole("heading", { level: 1, name: "Sukiennice" })).toBeVisible();

  // WHEN they press "Wstecz"
  await page.getByRole("link", { name: "Wstecz" }).click();

  // THEN the home screen opens instead of leaving the app
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mapa i lista miejsc" })).toBeAttached();
});
