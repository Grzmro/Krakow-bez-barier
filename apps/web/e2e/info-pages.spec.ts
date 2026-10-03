import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function openFromMenuWithKeyboard(page: Page, linkName: RegExp) {
  await page.getByRole("button", { name: "Menu" }).focus();
  await page.keyboard.press("Enter");
  const link = page.getByRole("link", { name: linkName });
  await expect(link).toBeVisible();
  for (let i = 0; i < 12 && !(await link.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
}

const PAGES = [
  { name: "about-data", link: /^O danych/, url: "/o-danych", title: "O danych" },
  { name: "privacy", link: /^Prywatność/, url: "/prywatnosc", title: "Prywatność" },
  { name: "accessibility-statement", link: /^Deklaracja dostępności/, url: "/deklaracja-dostepnosci", title: "Deklaracja dostępności" },
];

for (const info of PAGES) {
  test(`${info.title}: reachable from the menu by keyboard, structured and accessible`, async ({
    page,
    expectAccessible,
    evidence,
  }) => {
    // GIVEN the home page
    await page.goto("/");

    // WHEN a keyboard user opens the menu and picks the page
    await openFromMenuWithKeyboard(page, info.link);

    // THEN the page opens with its title as the only h1
    await expect(page).toHaveURL(info.url);
    await expect(page).toHaveTitle(`${info.title} · Kraków bez barier`);
    // The closing menu returns focus to its trigger; wait for it so later key presses aren't stolen.
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("button", { name: "Menu" })).toBeFocused();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(info.title);
    if (info.name === "about-data") {
      await expect(page.getByRole("heading", { level: 3, name: /OpenStreetMap/ })).toBeVisible();
    }
    await expect(page.locator("main")).toMatchAriaSnapshot({ name: `${info.name}.aria.yml` });

    // AND it has no WCAG 2.2 AA violations axe can detect
    await expectAccessible();
    await evidence(info.name);

    // AND the back link returns home from the keyboard
    await page.getByRole("link", { name: "Wróć na stronę główną" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/");
  });
}

test("O danych shows every source's refresh status, including an unavailable one", async ({ page }) => {
  // GIVEN the mocked GET /sources returns a working and an unavailable source
  // WHEN the About data page loads
  await page.goto("/o-danych");

  // THEN each source shows its status as text, with the outage note and last successful update
  const osm = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "OpenStreetMap" }) });
  await expect(osm).toContainText("Działa");
  const ziw = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /ZIW/ }) });
  await expect(ziw).toContainText("Niedostępne");
  await expect(ziw).toContainText("Źródło niedostępne (HTTP 404)");
  await expect(ziw).toContainText("Ostatnia udana aktualizacja");
  await expect(ziw).toContainText("Ostatnia próba");

  // AND the data is labelled as sample while the API is mocked, with OSM attribution visible
  await expect(page.getByText("Dane przykładowe").first()).toBeAttached();
  await expect(page.getByText("© OpenStreetMap contributors").first()).toBeVisible();
});
