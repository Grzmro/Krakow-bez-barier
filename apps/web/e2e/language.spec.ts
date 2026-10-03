import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// US-8.6: a tourist switches the app to English in the menu; the choice is remembered and `lang` follows it.

const settle = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));

async function chooseLanguage(page: Page, menu: string, language: "Polski" | "English") {
  await page.getByRole("button", { name: menu }).click();
  const option = page.getByRole("radio", { name: language });
  await option.focus();
  await page.keyboard.press("Space");
  await expect(option).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("the language switch turns the demo path into English, remembers it and sets lang", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  test.setTimeout(45_000);
  // GIVEN a first visit, in Polish by default
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.getByRole("region", { name: "Lista miejsc" }).getByRole("heading", { level: 2 })).toHaveText("9 miejsc");

  // WHEN the visitor opens the menu, where the language switch names each language in itself
  await page.getByRole("button", { name: "Menu" }).click();
  const languages = page.getByRole("group", { name: "Język" });
  await expect(languages.getByRole("radio", { name: "Polski" })).toBeChecked();
  await settle(page);
  await expectAccessible();
  await evidence("language-menu");
  await page.keyboard.press("Escape");

  // AND picks English with the keyboard
  await chooseLanguage(page, "Menu", "English");

  // THEN the page, its key texts and API labels switch to English at once
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const list = page.getByRole("region", { name: "List of places" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("9 places");
  await expect(page.getByRole("combobox", { name: "Search for a place" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Step-free" })).toBeVisible();
  await expect(list.getByRole("link", { name: /Sukiennice/ })).toContainText("Step-free entrance · Lift");

  // AND it is remembered on the next visit, rendered by the server in English
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("Kraków bez barier");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeAttached();

  // AND the profile verdicts and reasons are English
  await page.getByRole("radio", { name: "Wheelchair", exact: true }).check();
  const restaurant = list.getByRole("listitem").filter({ has: page.getByRole("link", { name: /Restauracja Przykład/ }) });
  await expect(restaurant).toContainText("Doesn't meet");
  await expect(restaurant).toContainText("2 steps");
  await settle(page);
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-en.aria.yml" });
  await expectAccessible();
  await evidence("language-home-en");

  // AND the place card is English too, while the place name and sources stay as they are
  await page.goto("/miejsca/hotel-przyklad");
  await expect(page).toHaveTitle("Place card · Kraków bez barier");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hotel Przykład");
  await expect(page.getByRole("heading", { name: "Facts" })).toBeVisible();
  await expect(page.getByRole("button", { name: "This isn't right" }).first()).toBeVisible();
  await settle(page);
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "place-en.aria.yml" });
  await expectAccessible();
  await evidence("language-place-en");

  // AND switching back restores Polish
  await chooseLanguage(page, "Menu", "Polski");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.getByRole("heading", { name: "Fakty" })).toBeVisible();
  await expect(page).toHaveTitle("Karta miejsca · Kraków bez barier");
});

test("an info page renders in English on the server", async ({ page, expectAccessible }) => {
  // GIVEN English was chosen before
  await page.goto("/");
  await page.evaluate(() => (document.cookie = "kbb-lang=en; path=/"));
  // WHEN the privacy page is opened
  await page.goto("/prywatnosc");
  // THEN its title, heading and back link are English
  await expect(page).toHaveTitle("Privacy · Kraków bez barier");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");
  await expect(page.getByRole("link", { name: "Back to the home page" })).toBeVisible();
  await expectAccessible();
});
