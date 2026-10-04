import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { gotoAllPlaces, searchFor } from "./map";

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
  await gotoAllPlaces(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.getByRole("region", { name: "Lista miejsc" }).getByRole("heading", { level: 2 })).toHaveText("10 miejsc");

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
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("10 places");
  await expect(page.getByRole("combobox", { name: "Search for a place" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Step-free" })).toBeVisible();
  await expect(list.getByRole("link", { name: /Sukiennice/ })).toContainText("Step-free entrance · Lift");

  // AND it is remembered on the next visit, rendered by the server in English
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("Kraków bez barier");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeAttached();

  // AND the profile verdicts and reasons are English (the reload went back to the clean start, so search again)
  await searchFor(page, "r");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("10 places");
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
  await expect(page).toHaveTitle("Hotel Przykład · Kraków bez barier");
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
  await expect(page).toHaveTitle("Hotel Przykład · Kraków bez barier");
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

test("the route screen, opened from the menu, is English end to end", async ({ page, expectAccessible, evidence }) => {
  // Two screens, a route plan, axe and evidence: more than the 15 s budget on a loaded machine.
  test.setTimeout(30_000);
  // GIVEN a visitor who switched to English
  await page.goto("/");
  await chooseLanguage(page, "Menu", "English");

  // WHEN they open "Plan a route" from the menu
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: /Plan a route/ }).click();

  // THEN, with location refused and no chosen start, the screen says in English that it has no route to plan
  await expect(page).toHaveTitle("Route · Kraków bez barier");
  const main = page.locator("main");
  await expect(main).toContainText("No permission to use location. We don't plan a route without a start");

  // WHEN they choose the station as the start
  await page.getByRole("combobox", { name: "From" }).click();
  await page.getByRole("option", { name: "Main Railway Station" }).click();

  // THEN the route summary, the turn instructions and the segment notes are English
  await expect(page).toHaveURL(/\/trasa\?z=station$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
  await expect(main).toContainText("No known barriers, but 336 m without data");
  await expect(main).toContainText("no data on 5 segments (336 m)");
  const step = page.getByRole("button", { name: /^Segment 2 of 33\. Turn right, 257 metres\. Partly unknown/ });
  await step.focus();
  await page.keyboard.press("Enter");
  const details = page.locator(`#${await step.getAttribute("aria-controls")}`);
  await expect(details).toContainText("Path surface: paving slabs");
  await expect(details).toContainText(/OpenStreetMap \(przez openrouteservice\) · 03\/10\/2026 · community/);
  await expect(step).toContainText("no surface data on part of the segment");
  await expect(main).not.toContainText(/brak danych|Skręć|Odcinek/);
  await settle(page);
  await expectAccessible();
  await evidence("language-route-en");
});
