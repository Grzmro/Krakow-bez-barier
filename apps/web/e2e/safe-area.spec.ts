import { devices, type Locator, type Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 15"];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

// The home indicator strip on Face ID iPhones, as Safari reports it in env(safe-area-inset-bottom).
const HOME_INDICATOR = 34;

async function withHomeIndicator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: 59, topMax: 59, bottom: HOME_INDICATOR, bottomMax: HOME_INDICATOR },
  });
}

const bottomEdge = async (target: Locator) => {
  const box = await target.boundingBox();
  return box ? box.y + box.height : Number.POSITIVE_INFINITY;
};

// Polls: sheets and toasts slide in from below, so their first frames still overlap the indicator.
async function expectAboveHomeIndicator(page: Page, target: Locator) {
  await expect.poll(() => bottomEdge(target)).toBeLessThanOrEqual(page.viewportSize()!.height - HOME_INDICATOR);
}

test("the home list panel ends above the home indicator", async ({ page, expectAccessible, evidence }) => {
  // GIVEN an iPhone with a home indicator
  await withHomeIndicator(page);

  // WHEN the visitor opens the map and expands the list panel
  await page.goto("/");
  await page.getByRole("button", { name: "Rozwiń arkusz" }).click();
  const panel = page.getByRole("region", { name: "Lista miejsc" });
  await expect(panel).toHaveAttribute("data-expanded", "true");

  // THEN, scrolled to the end of the page, the panel stays clear of the indicator
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expectAboveHomeIndicator(page, panel);
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "safe-area-home.aria.yml" });
  await expectAccessible();
  await evidence("safe-area-home");
});

test("the menu drawer keeps its last link above the home indicator", async ({ page, expectAccessible, evidence }) => {
  // GIVEN an iPhone with a home indicator
  await withHomeIndicator(page);
  await page.goto("/");

  // WHEN the visitor opens the menu
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(drawer).toBeVisible();

  // THEN the sheet reaches the screen edge but its last link, scrolled to, sits above the indicator
  const lastLink = drawer.getByRole("link").last();
  await lastLink.scrollIntoViewIfNeeded();
  await expectAboveHomeIndicator(page, lastLink);
  await expect.poll(() => bottomEdge(drawer)).toBeCloseTo(page.viewportSize()!.height, 0);
  await expectAccessible();
  await evidence("safe-area-menu");
});

test("the threshold drawer's buttons stay above the home indicator", async ({ page }) => {
  // GIVEN an iPhone with a home indicator and the wheelchair profile on
  await withHomeIndicator(page);
  await page.goto("/profil");
  await page.getByRole("radio", { name: "Wózek", exact: true }).check();

  // WHEN the visitor opens the threshold editor
  await page.getByRole("button", { name: "Progi profilu" }).click();
  const drawer = page.getByRole("dialog", { name: "Progi profilu" });
  await expect(drawer).toBeVisible();

  // THEN "Gotowe", scrolled to within the sheet, can be tapped without hitting the indicator
  const done = drawer.getByRole("button", { name: "Gotowe" });
  await done.scrollIntoViewIfNeeded();
  await expectAboveHomeIndicator(page, done);
});

test("the report form's send button and the thank-you toast stay above the home indicator", async ({
  page,
  evidence,
}) => {
  // GIVEN an iPhone with a home indicator on a place card
  await withHomeIndicator(page);
  await page.goto("/miejsca/teatr-slowackiego");

  // WHEN the visitor opens the report form
  const ramp = page.locator("li").filter({ has: page.getByRole("button", { name: /Podjazd/ }) });
  await ramp.getByRole("button", { name: "To się nie zgadza" }).click();
  const drawer = page.getByRole("dialog", { name: "To się nie zgadza" });
  await expect(drawer).toBeVisible();

  // THEN "Wyślij", scrolled to within the sheet, sits above the indicator
  await drawer.getByText("Nie ma podjazdu").click();
  const send = drawer.getByRole("button", { name: "Wyślij" });
  await send.scrollIntoViewIfNeeded();
  await expectAboveHomeIndicator(page, send);
  await evidence("safe-area-report");

  // AND after sending, the toast with "Cofnij" does too
  await send.click();
  const toast = page.locator("[data-sonner-toast]");
  await expect(toast.getByRole("button", { name: "Cofnij" })).toBeVisible();
  await expectAboveHomeIndicator(page, toast);
});
