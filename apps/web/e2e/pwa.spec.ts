import { expect, test } from "./fixtures";

test("web app manifest makes the app installable", async ({ request }) => {
  // GIVEN the manifest Next.js serves for app/manifest.ts
  // WHEN fetching it
  const response = await request.get("/manifest.webmanifest");

  // THEN it has what Chrome needs to install the app, in Polish, with the Fiolet colors
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "Kraków bez barier",
    short_name: "Bez barier",
    lang: "pl",
    start_url: "/",
    display: "standalone",
    theme_color: "#5b3df5",
    background_color: "#faf8f5",
  });
  const sizes = manifest.icons.map((icon: { sizes: string; purpose: string }) => `${icon.sizes} ${icon.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]));
  for (const icon of [...manifest.icons, { src: "/icons/apple-touch-icon.png" }]) {
    const image = await request.get(icon.src);
    expect(image.headers()["content-type"], icon.src).toBe("image/png");
  }
});

test.describe("install banner on an iPhone", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });

  test("Safari shows the Add to Home Screen hint, dismissable by keyboard", async ({
    page,
    expectAccessible,
    evidence,
  }) => {
    // GIVEN the app opened in Safari on an iPhone
    await page.goto("/");

    // WHEN the page hydrates
    const banner = page.getByRole("complementary", { name: "Instalacja aplikacji" });

    // THEN the manual install hint is shown and passes axe, and "Nie teraz" removes it
    await expect(banner).toMatchAriaSnapshot({ name: "install-banner-ios.aria.yml" });
    await expectAccessible();
    await evidence("install-banner-ios");
    await banner.getByRole("button", { name: "Nie teraz" }).focus();
    await page.keyboard.press("Enter");
    await expect(banner).toHaveCount(0);
  });

  test("the native app (Capacitor) shows no install banner", async ({ page, evidence }) => {
    // GIVEN the page runs inside the iOS Capacitor WebView (its bridge handler is present)
    await page.addInitScript(() => {
      Object.assign(window, { webkit: { messageHandlers: { bridge: { postMessage: () => undefined } } } });
    });

    // WHEN the page has hydrated (the menu opens and closes)
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // THEN there is no install banner
    await expect(page.getByRole("complementary", { name: "Instalacja aplikacji" })).toHaveCount(0);
    await evidence("install-banner-native");
  });

  for (const [name, path] of [
    ["the embeddable widget", "/widget/hotel-przyklad"],
    ["an organizer's event page", "/wydarzenie/hotel-przyklad"],
  ]) {
    test(`${name} offers no install`, async ({ page }) => {
      // GIVEN Safari on an iPhone, which shows the hint on the app's own pages
      // WHEN the page has loaded its place
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Hotel Przykład");

      // THEN there is no install banner
      await expect(page.getByRole("complementary", { name: "Instalacja aplikacji" })).toHaveCount(0);
    });
  }

  test("an app page framed by another site offers no install", async ({ page, context, baseURL }) => {
    // GIVEN another site that frames the app's home page (Chromium needs the permission for public → localhost frames)
    const site = "https://strona.przyklad.test/";
    await context.grantPermissions(["local-network-access"]);
    await page.route(site, (route) =>
      route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><html lang="pl"><title>Strona</title><iframe src="${baseURL}/" title="Aplikacja" width="100%" height="700"></iframe></html>`,
      }),
    );

    // WHEN the framed app has hydrated (its menu opens)
    await page.goto(site);
    const app = page.frameLocator("iframe");
    await app.getByRole("button", { name: "Menu" }).click();
    await expect(app.getByRole("dialog")).toBeVisible();

    // THEN it shows no install banner
    await expect(app.getByRole("complementary", { name: "Instalacja aplikacji" })).toHaveCount(0);
  });
});
