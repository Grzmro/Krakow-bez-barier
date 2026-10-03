import { expect, test } from "./fixtures";

test("a narrowed map has a back button and the logo, both returning to the whole map", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the home screen with every sample place and no back button
  await page.goto("/");
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
  const back = page.getByRole("button", { name: "Wróć do całej mapy" });
  await expect(back).toHaveCount(0);

  // WHEN the visitor narrows the map to museums
  await page.getByRole("button", { name: "Muzea" }).click();

  // THEN a back button appears next to the search field
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("4 miejsca");
  await expect(back).toBeVisible();
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-narrowed.aria.yml" });
  await expectAccessible();
  await evidence("home-narrowed-back");

  // WHEN a keyboard user presses it
  await back.press("Enter");

  // THEN every place is back, the button is gone and focus lands on the search field
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
  await expect(page.getByRole("button", { name: "Wszystko" })).toHaveAttribute("aria-pressed", "true");
  await expect(back).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Wyszukaj miejsce" })).toBeFocused();

  // WHEN they narrow the map again with a search and press the logo
  await page.getByRole("combobox", { name: "Wyszukaj miejsce" }).fill("Sukiennice");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("1 miejsce");
  await page.getByRole("link", { name: "Kraków bez barier — strona główna" }).click();

  // THEN the logo also returns to the whole map, on the same page
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
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

test("back from the route screen returns to the card and then the list, without looping", async ({ page, expectAccessible }) => {
  // GIVEN a place opened from the home screen's list, then its route
  await page.goto("/");
  await page.getByRole("region", { name: "Lista miejsc" }).getByRole("link", { name: /Sukiennice/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sukiennice" })).toBeVisible();
  await page.getByRole("link", { name: "Prowadź" }).click();
  await expect(page).toHaveURL(/\/trasa\?do=sukiennice$/);
  await expectAccessible();

  // WHEN a keyboard user presses the route screen's "Wstecz"
  await page.locator("main").getByRole("link", { name: "Wstecz" }).press("Enter");

  // THEN the card is back, and the browser's back now leads to the list, not to the route again
  await expect(page.getByRole("heading", { level: 1, name: "Sukiennice" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mapa i lista miejsc" })).toBeAttached();
});

test("an event page opened from a shared link has a back button to the home screen", async ({ page, expectAccessible, evidence }) => {
  // GIVEN an event page opened straight from a link
  await page.goto("/wydarzenie/palac-krzysztofory?nazwa=Koncert+jesienny");
  await expect(page.getByRole("heading", { level: 1, name: "Koncert jesienny" })).toBeVisible();
  const back = page.getByRole("banner").getByRole("link", { name: "Wstecz" });
  await expect(back).toBeVisible();
  await expectAccessible();
  await evidence("event-back");

  // WHEN the guest presses "Wstecz" in the header
  await back.click();

  // THEN the home screen opens instead of leaving the app
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mapa i lista miejsc" })).toBeAttached();
});
