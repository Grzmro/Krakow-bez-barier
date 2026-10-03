import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// The route's start: "Moja lokalizacja", a place from the database, or Dworzec Główny (default). POST /routes answers from
// openrouteservice responses recorded for these starts to Rynek Główny (src/server/routing/fixtures) — no network. The device
// position is Playwright's emulated geolocation.

const CLIENT = "e2e-route-start";
// A point on the Planty with a recorded route; three decimals, so the rounded link points at the same spot.
const PLANTY = { latitude: 50.065, longitude: 19.942, accuracy: 10 };

// POST /routes allows 30 requests a minute per client; its own client key keeps this file from using up the others' share.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/routes", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-vercel-forwarded-for": CLIENT } }),
  );
});

async function openRoute(page: Page) {
  await page.goto("/trasa");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
}

const startField = (page: Page) => page.getByRole("combobox", { name: "Start" });

test.describe("with location access", () => {
  test.use({ permissions: ["geolocation"], geolocation: PLANTY });

  test("'Moja lokalizacja' starts the route at the device position and puts a rounded point in the link", async ({
    page,
    expectAccessible,
    evidence,
  }) => {
    // GIVEN the route screen, starting at Dworzec Główny by default
    await openRoute(page);
    await expect(startField(page)).toHaveValue("Dworzec Główny");

    // WHEN a keyboard user opens the start field and picks "Moja lokalizacja"
    await startField(page).focus();
    await page.keyboard.press("ArrowDown");
    const me = page.getByRole("option", { name: /Moja lokalizacja/ });
    await expect(me).toBeVisible();
    await expect(page.getByRole("option", { name: "Dworzec Główny" })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    await expect(me).toHaveAttribute("data-highlighted", "");
    await page.keyboard.press("Enter");

    // THEN the route starts where they are, and the link carries only the position rounded to ~100 m
    await expect(startField(page)).toHaveValue("Moja lokalizacja");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/7 min/);
    await expect(page).toHaveURL(/\/trasa\?z=50\.065,19\.942$/);
    await expect(page.getByRole("status")).toContainText("Trasa nie zawiera znanych barier");
    await expect(page.locator("main")).toMatchAriaSnapshot({ name: "route-start-me.aria.yml" });
    await expectAccessible();
    await evidence("route-start-me");

    // WHEN the link is opened again
    await page.reload();

    // THEN the same route opens, from the shared point
    await expect(startField(page)).toHaveValue("Punkt z linku");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/7 min/);
  });
});

test("a refused location says why, keeps Dworzec Główny as the start and is read out", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a browser that refuses location access
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) =>
      fail?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
  });
  await openRoute(page);

  // WHEN the visitor picks "Moja lokalizacja"
  await startField(page).click();
  await page.getByRole("option", { name: /Moja lokalizacja/ }).click();

  // THEN they learn why and what to do, the route still starts at the station, and nothing is blocked
  const notice = "Brak zgody na lokalizację.";
  await expect(page.locator("main")).toContainText(notice);
  await expect(page.locator("main")).toContainText("Trasa zaczyna się dalej: Dworzec Główny.");
  await expect(page.getByRole("status")).toContainText(notice);
  await expect(startField(page)).toHaveValue("Dworzec Główny");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
  await expect(page).toHaveURL(/\/trasa$/);
  // AND the way to allow it is one click away
  await page.getByText("Jak to włączyć?").click();
  await expect(page.locator("main")).toContainText("Potem spróbuj ponownie.");
  await expectAccessible();
  await evidence("route-start-denied");

  // WHEN they dismiss the message
  await page.getByRole("button", { name: "Zamknij komunikat" }).click();

  // THEN it is gone and the route stays
  await expect(page.locator("main")).not.toContainText(notice);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
});

test("a place found by name becomes the start, also from a shared link", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the route screen
  await openRoute(page);

  // WHEN a keyboard user types part of a place's name and picks it from the suggestions
  await startField(page).focus();
  await page.keyboard.type("Kawiar");
  const option = page.getByRole("option", { name: /Kawiarnia Przykład/ });
  await expect(option).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(option).toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("Enter");

  // THEN the route starts at that place and the link names it
  await expect(startField(page)).toHaveValue("Kawiarnia Przykład");
  await expect(page).toHaveURL(/\/trasa\?z=kawiarnia-przyklad$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/7 min/);
  await expectAccessible();
  await evidence("route-start-place");

  // WHEN someone opens that link
  await page.goto("/trasa?z=kawiarnia-przyklad");

  // THEN the same start is set
  await expect(startField(page)).toHaveValue("Kawiarnia Przykład");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/7 min/);

  // WHEN the link names a place that doesn't exist
  await page.goto("/trasa?z=nie-ma-takiego");

  // THEN the route starts at the station and says why
  await expect(page.locator("main")).toContainText("Nie znaleźliśmy miejsca startu z linku");
  await expect(startField(page)).toHaveValue("Dworzec Główny");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
});
