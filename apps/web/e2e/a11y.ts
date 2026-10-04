import { expect, type Locator, type Page } from "@playwright/test";

/** The screens of the demo's main scenario (docs/demo-script.md) the accessibility checks walk, on the sample data. */
export const SCREENS: { name: string; url: string; heading: RegExp }[] = [
  { name: "home", url: "/", heading: /Mapa i lista miejsc/ },
  { name: "place", url: "/miejsca/hotel-przyklad", heading: /Hotel Przykład/ },
  { name: "place-conflict", url: "/miejsca/palac-krzysztofory", heading: /Pałac Krzysztofory/ },
  { name: "place-incomplete", url: "/miejsca/kawiarnia-przyklad", heading: /Kawiarnia Przykład/ },
  { name: "about-data", url: "/o-danych", heading: /O danych/ },
  { name: "business", url: "/dla-firm", heading: /Dla firm/ },
  { name: "accessibility-statement", url: "/deklaracja-dostepnosci", heading: /Deklaracja dostępności/ },
];

/**
 * Presses Tab (Shift+Tab with `back`) until `target` has focus — the way a keyboard user gets there — and fails if it
 * never does.
 */
export async function tabTo(page: Page, target: Locator, maxTabs = 40, { back = false } = {}) {
  for (let i = 0; i < maxTabs && !(await target.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
  }
  await expect(target).toBeFocused();
}

/** How far the page scrolls sideways; 0 means the content reflows to the window. */
export const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
