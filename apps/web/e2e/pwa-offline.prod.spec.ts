import { expect, test } from "./fixtures";

// Runs against `next start` (project chromium-prod): the service worker is production-only.
test("other screens run without a service worker under automation", async ({ page }) => {
  // GIVEN a spec that doesn't opt in
  // WHEN the home page has loaded
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();

  // THEN no service worker is registered, so cached responses can't leak between specs
  const registrations = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
  expect(registrations).toBe(0);
});

test("home page works offline after the first visit and says so", async ({
  page,
  context,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a visitor whose browser registered the service worker on the first visit
  await page.addInitScript(() => {
    window.__kbbServiceWorker = true;
  });
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator("main")).toBeVisible();

  // WHEN the connection drops and they open the app again
  await context.setOffline(true);
  await page.reload();

  // THEN the home page comes from the cache with the offline notice and the date of the data
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kraków bez barier");
  await expect(page.getByRole("note").filter({ hasText: "Jesteś offline" })).toHaveText(
    /^Jesteś offline — pokazujemy dane z \d{1,2} \S+ \d{4} \d{1,2}:\d{2}\.$/,
  );
  await expect(page.getByRole("status")).toContainText("Jesteś offline");
  await expectAccessible();
  await evidence("pwa-offline-home");

  // AND a page that was never cached falls back to the offline page
  await page.goto("/prywatnosc");
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "offline.aria.yml" });
  await expectAccessible();
  await evidence("pwa-offline-fallback");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();

  // AND the notice goes away once the connection is back
  await context.setOffline(false);
  await page.goto("/");
  await expect(page.getByRole("note").filter({ hasText: "Jesteś offline" })).toHaveCount(0);
});
