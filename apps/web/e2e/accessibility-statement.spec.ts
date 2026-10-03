import { expect, test } from "./fixtures";

// KBB-77 / R6: the accessibility statement lists what works, the limitations with a status, and what we have not checked.

test.describe("phone, 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the statement is structured, shows every limitation with a status as text, and the contents jump to sections", async ({
    page,
    expectAccessible,
    evidence,
  }) => {
    // GIVEN the statement on a phone
    await page.goto("/deklaracja-dostepnosci");

    // THEN it has one h1, the update date, the conformity block and the sections as h2
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Deklaracja dostępności");
    await expect(page.getByText("Ostatnia aktualizacja")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Stan zgodności",
      "Co działa",
      "Znane ograniczenia i plan poprawy",
      "Czego nie sprawdziliśmy",
      "Zgłoś barierę",
      "Procedura odwoławcza",
    ]);

    // AND each limitation carries its status as text next to its icon
    const limits = page.locator("#ograniczenia").getByRole("listitem");
    await expect(limits).toHaveCount(7);
    for (const item of await limits.all()) {
      await expect(item.getByText(/^(Zrobione|W toku|Planowane|Poza zakresem)$/)).toBeVisible();
    }

    // AND the page does not scroll sideways
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // WHEN the contents are opened and a section picked, with the keyboard
    const summary = page.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    const link = page.getByRole("link", { name: "Czego nie sprawdziliśmy" });
    await expect(link).toBeVisible();
    await link.focus();
    await page.keyboard.press("Enter");

    // THEN the section is reached
    await expect(page).toHaveURL(/#niesprawdzone$/);
    await expect(page.getByRole("heading", { level: 2, name: "Czego nie sprawdziliśmy" })).toBeInViewport();

    // AND axe finds nothing
    await expectAccessible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await evidence("accessibility-statement-390");
  });
});

test.describe("desktop, 1440 px", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test("the contents sit beside the text and the line stays readable", async ({ page, expectAccessible, evidence }) => {
    // GIVEN the statement on a desktop
    await page.goto("/deklaracja-dostepnosci");

    // THEN the contents are a visible list of anchors, not the collapsible one
    const nav = page.getByRole("navigation", { name: "Spis treści" });
    await expect(nav.getByRole("link")).toHaveCount(6);
    await expect(nav.getByRole("link", { name: "Zgłoś barierę" })).toBeVisible();
    await expect(nav.locator("summary")).toBeHidden();

    // AND the text column is no wider than about 70 characters
    const width = await page.getByText("Każdy punkt ma sprawdzający").evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(680);

    // AND axe finds nothing
    await expectAccessible();
    await evidence("accessibility-statement-1440");
  });
});

test.describe("English", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the English version is complete, structured and accessible", async ({
    page,
    context,
    baseURL,
    expectAccessible,
    evidence,
  }) => {
    // GIVEN a visitor who chose English
    await context.addCookies([{ name: "kbb-lang", value: "en", url: baseURL! }]);

    // WHEN they open the statement
    await page.goto("/deklaracja-dostepnosci");

    // THEN it is in English, with the same structure
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Accessibility statement · Kraków bez barier");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accessibility statement");
    await expect(page.locator("main")).toMatchAriaSnapshot({ name: "accessibility-statement-en.aria.yml" });

    // AND axe finds nothing
    await expectAccessible();
    await evidence("accessibility-statement-en");
  });
});
