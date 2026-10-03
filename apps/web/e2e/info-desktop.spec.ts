import { horizontalOverflow } from "./a11y";
import { expect, test } from "./fixtures";

// The header and the info pages as a laptop or monitor shows them (the desktop project).

const WIDTHS = [1280, 1440, 1920];
const PAGES = [
  { name: "about-data", url: "/o-danych", nav: "O danych", ready: "OpenStreetMap" },
  { name: "privacy", url: "/prywatnosc", nav: "Prywatność", ready: "Prywatność" },
  { name: "business", url: "/dla-firm", nav: /Dla firm/, ready: /Dla firm/ },
  {
    name: "accessibility-statement",
    url: "/deklaracja-dostepnosci",
    nav: "Deklaracja dostępności",
    ready: "Deklaracja dostępności",
  },
];
const EVENT = "/wydarzenie/palac-krzysztofory?nazwa=Koncert+jesienny&data=2026-10-10";
const NAV = "Nawigacja główna";

test("the header shows the main navigation directly and hides the hamburger", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the home screen in a 1440 px window
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: NAV });

  // THEN every public menu destination is a link in the header and there is no hamburger
  for (const name of [/Zaplanuj trasę/, "O danych", /Dla firm/, "Prywatność", "Deklaracja dostępności"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
  // AND the internal moderator panel is not part of the public navigation
  await expect(nav.getByRole("link", { name: /moderator/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  await expect(nav.getByRole("radio", { name: "English" })).toBeAttached();
  await expect(nav).toMatchAriaSnapshot({ name: "header-desktop.aria.yml" });
  await expectAccessible();
  await evidence("header-desktop");
});

test("'W mojej okolicy' stays reachable from the header and closes with Escape", async ({ page }) => {
  // GIVEN the home screen in a desktop window
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const trigger = page.getByRole("navigation", { name: NAV }).getByRole("button", { name: /W mojej okolicy/ });

  // WHEN it is opened from the keyboard
  await trigger.focus();
  await page.keyboard.press("Enter");

  // THEN the popover offers the locate action, and Escape returns focus to the trigger
  const popup = page.getByRole("dialog", { name: /W mojej okolicy/ });
  await expect(popup.getByRole("button", { name: /W mojej okolicy/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("the header navigation marks the current page and works by keyboard", async ({ page }) => {
  // GIVEN the privacy page in a desktop window
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/prywatnosc");
  const nav = page.getByRole("navigation", { name: NAV });

  // THEN only its link is the current page
  await expect(nav.locator('a[aria-current="page"]')).toHaveText("Prywatność");

  // WHEN a keyboard user focuses another link and activates it
  const about = nav.getByRole("link", { name: "O danych" });
  await about.focus();
  await expect(about).toBeFocused();
  await page.keyboard.press("Enter");

  // THEN that page opens and becomes the current one
  await expect(page).toHaveURL("/o-danych");
  await expect(nav.locator('a[aria-current="page"]')).toHaveText("O danych");
});

test("the skip link is still the first tab stop and lands on main", async ({ page }) => {
  // GIVEN a desktop info page
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/prywatnosc");

  // WHEN the visitor presses Tab once and activates the link
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Przejdź do treści" })).toBeFocused();
  await page.keyboard.press("Enter");

  // THEN focus is on the main landmark
  await expect(page.locator("main")).toBeFocused();
});

for (const info of PAGES) {
  for (const width of WIDTHS) {
    test(`${info.name} at ${width}px fills a centred column without horizontal scroll`, async ({
      page,
      expectAccessible,
      evidence,
    }) => {
      // GIVEN the page in a desktop window
      await page.setViewportSize({ width, height: 900 });
      await page.goto(info.url);
      await expect(page.getByRole("heading", { name: info.ready }).first()).toBeVisible();
      if (info.name === "about-data") {
        await expect(page.getByRole("listitem").filter({ hasText: "MSIP" })).toBeVisible();
      }

      // THEN the content column is centred, at least 700 px wide and never stretched past 72 rem
      const main = (await page.locator("main").boundingBox())!;
      expect(main.width).toBeGreaterThanOrEqual(700);
      expect(main.width).toBeLessThanOrEqual(1152);
      expect(Math.abs(main.x - (width - main.x - main.width))).toBeLessThanOrEqual(1);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

      // AND the page's own link is the current one in the header
      await expect(page.getByRole("navigation", { name: NAV }).locator('a[aria-current="page"]')).toHaveText(
        info.nav,
      );

      if (width === 1440) {
        await expect(page.locator("main")).toMatchAriaSnapshot({ name: `${info.name}-desktop.aria.yml` });
        await expectAccessible();
        await evidence(`${info.name}-desktop`);
      }
    });
  }
}

test("O danych lists sources in two columns and the business page puts the preview beside the embed code", async ({
  page,
}) => {
  // GIVEN the About data page in a 1440 px window
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/o-danych");
  const cards = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) });
  await expect(cards.nth(1)).toBeVisible();

  // THEN the first two source cards share a row
  const [a, b] = [(await cards.nth(0).boundingBox())!, (await cards.nth(1).boundingBox())!];
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
  expect(a.x + a.width).toBeLessThanOrEqual(b.x);

  // WHEN opening the business page
  await page.goto("/dla-firm");
  const preview = page.getByRole("heading", { level: 2, name: "Podgląd na stronie obiektu" });
  const code = page.getByRole("heading", { level: 2, name: "Kod do wklejenia" });
  await expect(preview).toBeVisible();

  // THEN the embed code sits to the right of the preview, starting at the same height
  const [p, c] = [(await preview.boundingBox())!, (await code.boundingBox())!];
  expect(p.x + p.width).toBeLessThanOrEqual(c.x);
  expect(Math.abs(p.y - c.y)).toBeLessThanOrEqual(2);
});

test("at the 1024 px breakpoint the header fits in one row without horizontal scroll", async ({ page }) => {
  // GIVEN a page at the narrowest desktop width
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/prywatnosc");

  // THEN the navigation is visible, the hamburger hidden, the bar one row high and nothing overflows
  const nav = page.getByRole("navigation", { name: NAV });
  await expect(nav.getByRole("link", { name: "Deklaracja dostępności" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  expect((await nav.boundingBox())!.height).toBeLessThanOrEqual(64);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  const lang = (await nav.getByRole("group", { name: "Język" }).boundingBox())!;
  expect(lang.x + lang.width).toBeLessThanOrEqual(1024);
});

test("in English at 1024 px the header still fits in one row", async ({ page, context, baseURL }) => {
  // GIVEN the English UI (longer labels) at the narrowest desktop width
  await context.addCookies([{ name: "kbb-lang", value: "en", url: baseURL! }]);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/prywatnosc");

  // THEN the last link ends before the right-hand group starts and nothing overflows
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const last = (await nav.getByRole("link", { name: "Accessibility statement" }).boundingBox())!;
  const lang = (await nav.getByRole("group").last().boundingBox())!;
  expect(last.x + last.width).toBeLessThanOrEqual(lang.x - 8);
  expect(lang.x + lang.width).toBeLessThanOrEqual(1024);
  expect((await nav.boundingBox())!.height).toBeLessThanOrEqual(64);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test("on a phone the hamburger stays and the header links are hidden; print hides the header", async ({ page }) => {
  // GIVEN a phone-sized window
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/prywatnosc");

  // THEN only the hamburger is offered
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: NAV }).getByRole("link", { name: "O danych" })).toBeHidden();

  // AND printing hides the header
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("header")).toBeHidden();
});

for (const width of WIDTHS) {
  test(`the event page at ${width}px lays its cards out in two columns`, async ({ page, expectAccessible, evidence }) => {
    // GIVEN the event page in a desktop window
    await page.setViewportSize({ width, height: 900 });
    await page.goto(EVENT);
    const entrance = page.getByRole("region", { name: "Wejście" });
    const toilet = page.getByRole("region", { name: "Toaleta" });
    await expect(entrance).toBeVisible();

    // THEN the first two cards share a row and nothing scrolls sideways
    const [e, t] = [(await entrance.boundingBox())!, (await toilet.boundingBox())!];
    expect(Math.abs(e.y - t.y)).toBeLessThanOrEqual(1);
    expect(e.x + e.width).toBeLessThanOrEqual(t.x);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    if (width === 1440) {
      await expectAccessible();
      await evidence("event-page-desktop");
    }
  });
}
