import { expect, test } from "./fixtures";

const WAWEL = { latitude: 50.0541, longitude: 19.9354, accuracy: 20 };

test.describe("with location access granted", () => {
  test.use({ geolocation: WAWEL, permissions: ["geolocation"] });

  test("'W mojej okolicy' in the menu shows the device position by keyboard", async ({
    page,
    expectAccessible,
    evidence,
  }) => {
    // GIVEN the menu opened from the header
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    const nearMe = page.getByRole("button", { name: /W mojej okolicy/ });
    await expect(nearMe).toHaveAccessibleDescription(/zostaje na Twoim urządzeniu/);

    // WHEN a keyboard user activates "W mojej okolicy"
    await nearMe.focus();
    await page.keyboard.press("Enter");

    // THEN the position is shown and announced, and the dialog passes axe
    const found = "Jesteś tutaj: 50,05410° N, 19,93540° E (dokładność ±20 m)";
    await expect(page.getByRole("dialog").getByText(found)).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(found);
    await expect(nearMe).toBeFocused();
    await expectAccessible();
    await evidence("near-me");
  });

  test("/dev/native reports the platform and locates on load", async ({ page, expectAccessible, evidence }) => {
    // GIVEN / WHEN the diagnostics page opens in a browser
    await page.goto("/dev/native");

    // THEN it says it runs in a browser and shows the position without a tap
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Funkcje natywne");
    await expect(page.getByText("przeglądarka")).toBeVisible();
    await expect(page.locator("main").getByText(/Jesteś tutaj: 50,05410° N/)).toBeVisible();
    await expect(page.locator("main")).toMatchAriaSnapshot({ name: "dev-native.aria.yml" });
    await expectAccessible();
    await evidence("dev-native");
  });
});

test("'W mojej okolicy' explains a denied permission", async ({ page }) => {
  // GIVEN a browser that denies location access
  await page.goto("/");
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) =>
      fail?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
  });

  // WHEN the user asks for their position
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: /W mojej okolicy/ }).click();

  // THEN they learn why and how to fix it
  await expect(page.getByRole("dialog").getByText(/Brak zgody na lokalizację/)).toBeVisible();
});
