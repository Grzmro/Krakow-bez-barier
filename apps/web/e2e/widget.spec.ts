import { expect, test } from "./fixtures";

// The widget card comes from the openapi.yaml example served by the mock API (TODO(KBB-29)).

const HOTEL_SITE = "https://hotel.przyklad.test/";

test("the widget works embedded on a venue's own website, without an account", async ({ page, context, baseURL }) => {
  // GIVEN a hotel website on another origin that embeds the widget snippet
  // (a routed page counts as public, and Chromium blocks public → localhost frames unless allowed)
  await context.grantPermissions(["local-network-access"]);
  await page.route(HOTEL_SITE, (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html lang="pl"><title>Hotel</title><h1>Hotel Przykład</h1>
        <iframe src="${baseURL}/widget/hotel-przyklad" title="Dostępność" width="100%" height="560"></iframe></html>`,
    }),
  );

  // WHEN a visitor opens the hotel website
  await page.goto(HOTEL_SITE);
  const widget = page.frameLocator("iframe");

  // THEN the card shows facts with value, source and date, and names missing data as missing
  await expect(widget.getByRole("heading", { level: 1, name: "Hotel Przykład" })).toBeVisible();
  const facts = widget.getByRole("list", { name: "Cechy dostępności" });
  await expect(facts.getByRole("listitem").filter({ hasText: "Szerokość drzwi" })).toContainText(
    /90 cm.*Potwierdzone.*Dane obiektu · 12\.09\.2026/,
  );
  await expect(facts.getByRole("listitem").filter({ hasText: "Toaleta dostosowana" })).toContainText(
    /Jest.*Potwierdzone.*Dane obiektu · 12\.09\.2026/,
  );
  await expect(facts.getByRole("listitem").filter({ hasText: "Winda" })).toContainText(
    /Jest.*Niezweryfikowane.*OpenStreetMap/,
  );
  const changing = facts.getByRole("listitem").filter({ hasText: "Przewijak" });
  await expect(changing).toContainText(/Brak danych.*Nikt jeszcze nie sprawdził\./);
  await expect(changing.locator("[data-reliability]")).toHaveAttribute("data-reliability", "unknown");

  // AND it carries the OSM attribution, a link to the full card in a new tab, and no app navigation
  await expect(widget.getByText("© OpenStreetMap contributors")).toBeVisible();
  const fullCard = widget.getByRole("link", { name: /Pełna karta/ });
  await expect(fullCard).toHaveAttribute("href", "/miejsca/hotel-przyklad");
  await expect(fullCard).toHaveAttribute("target", "_blank");
  await expect(widget.getByRole("button", { name: "Menu" })).toHaveCount(0);
  // AND the app-wide sample banner gives way to the card's own PRZYKŁAD tag
  await expect(widget.getByText(/prototyp, dane mogą być przykładowe/)).toHaveCount(0);
});

test("the widget page is accessible and keyboard-operable", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the widget page opened directly, as the iframe loads it
  await page.goto("/widget/hotel-przyklad");
  const main = page.locator("main");
  await expect(main.getByRole("heading", { level: 1, name: "Hotel Przykład" })).toBeVisible();
  await expect(main).toMatchAriaSnapshot({ name: "widget.aria.yml" });

  // WHEN a keyboard user tabs past the skip link
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");

  // THEN focus lands on the full-card link
  await expect(page.getByRole("link", { name: /Pełna karta/ })).toBeFocused();

  await expectAccessible();
  await evidence("widget");
});

test("an unknown place id says so instead of showing another place", async ({ page }) => {
  // GIVEN a widget snippet with a place id that doesn't exist
  await page.goto("/widget/nie-ma-takiego");

  // THEN the widget says the place wasn't found
  await expect(page.locator("main")).toContainText("Nie znaleźliśmy tego miejsca w Kraków bez barier.");
});

test("the business page previews the widget and copies the embed code", async ({
  page,
  context,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a venue owner on the business page, reached from the menu
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: /Dla firm: widget i API/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dla firm" })).toBeVisible();

  // THEN the sample hotel page embeds the live widget and the API example is real spec data
  const main = page.locator("main");
  const preview = page.frameLocator('iframe[title="Dostępność: Hotel Przykład — Kraków bez barier"]');
  await expect(preview.getByRole("heading", { level: 1, name: "Hotel Przykład" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Odpowiedź API dla tego hotelu" })).toContainText('"changing_table"');
  await expect(main).toMatchAriaSnapshot({ name: "business.aria.yml" });
  // Checked before copying: axe misreads the toast's contrast while it fades in.
  await expectAccessible();
  await evidence("business");

  // WHEN the owner copies the embed code with the keyboard
  await page.getByRole("button", { name: "Kopiuj kod widgetu" }).focus();
  await page.keyboard.press("Enter");

  // THEN the clipboard holds an iframe pointing at this deployment's widget, and the copy is announced
  await expect(page.getByRole("status").filter({ hasText: "Skopiowano do schowka" })).toBeAttached();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(`<iframe src="${new URL(page.url()).origin}/widget/hotel-przyklad"`);
});

test("the widget's full card link opens the hotel's place card", async ({ page }) => {
  // GIVEN the link target of the demo hotel's widget
  await page.goto("/miejsca/hotel-przyklad");

  // THEN the full card shows the same hotel and the same facts as the widget
  await expect(page.getByRole("heading", { level: 1, name: "Hotel Przykład" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Toaleta dostosowana.*Jest.*Potwierdzone/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Winda.*Jest.*Niezweryfikowane/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Przewijak.*Brak danych/ })).toBeVisible();
});
