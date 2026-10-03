import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Guidance after "Ruszamy" on the recorded Dworzec Główny → Rynek route (see route.spec.ts). The device position is
// Playwright's emulated geolocation, moved with `context.setGeolocation`; no real GPS, no waiting on timers.

const CLIENT = "e2e-route-guidance";

// POST /routes allows 30 requests a minute per client; its own client key keeps this file from using up the others' share.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/routes", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-vercel-forwarded-for": CLIENT } }),
  );
});

type Segment = { instruction: string; lengthMeters: number; geometry: { coordinates: [number, number][] } };

/** The segments the screen shows: the same avoid-stairs request it sends without a profile. */
async function segments(request: APIRequestContext): Promise<Segment[]> {
  const response = await request.post("/api/v1/routes", {
    headers: { "x-vercel-forwarded-for": CLIENT },
    data: {
      from: { type: "Point", coordinates: [19.9461, 50.0668] },
      to: { type: "Point", coordinates: [19.9373, 50.0617] },
      avoidStairs: true,
    },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).segments;
}

const at = ([longitude, latitude]: [number, number]) => ({ longitude, latitude, accuracy: 10 });

async function openRoute(page: Page) {
  await page.goto("/trasa");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
}

test.describe("with location access", () => {
  test.use({ permissions: ["geolocation"], geolocation: { latitude: 50.0668, longitude: 19.9461, accuracy: 10 } });

  test("'Ruszamy' guides step by step as the position moves, and offers a new route off it", async ({
    page,
    context,
    request,
    expectAccessible,
    evidence,
  }) => {
    // GIVEN a walker at the start of the route screen's first step
    const steps = await segments(request);
    const total = steps.length;
    await context.setGeolocation(at(steps[0].geometry.coordinates[0]));
    await openRoute(page);

    // WHEN they press "Ruszamy"
    await page.getByRole("button", { name: "Ruszamy" }).click();

    // THEN guidance starts on step 1 with what's next and the distance and time left, by their position
    const main = page.locator("main");
    await expect(page.getByRole("heading", { level: 1, name: "Prowadzenie" })).toBeFocused();
    await expect(main).toContainText("Prowadzimy według Twojej pozycji");
    await expect(main).toContainText(`Krok 1 z ${total}`);
    await expect(main).toContainText(`${steps[1].instruction} za`);
    await expect(main).toContainText(/Do celu: [\d,]+ k?m · \d+ min/);
    await expect(page.getByRole("switch", { name: "Mapa podąża za mną" })).toBeChecked();
    // AND the "Krok po kroku" list stays, with the current step marked
    await expect(page.getByRole("list", { name: /Odcinki trasy/ }).locator("li[aria-current=step]")).toHaveCount(1);
    await expect(main).toMatchAriaSnapshot({ name: "route-guidance.aria.yml" });
    await expectAccessible();
    await evidence("route-guidance");

    // WHEN the walker reaches the end of step 1, then of step 2
    await context.setGeolocation(at(steps[0].geometry.coordinates.at(-1)!));

    // THEN step 2 takes over and is read out
    await expect(main).toContainText(`Krok 2 z ${total}`);
    await expect(page.getByRole("status")).toContainText(`Krok 2 z ${total}: ${steps[1].instruction}`);
    // AND the gap in the data on that step is named with its source, date and reliability
    await expect(main).toContainText(/Na tym odcinku: Brak danych — brak danych o nawierzchni.*\(OpenStreetMap.*\d{1,2}\.\d{1,2}\.\d{4} · \S[^)]*\)/);

    await context.setGeolocation(at(steps[1].geometry.coordinates.at(-1)!));
    await expect(main).toContainText(`Krok 3 z ${total}`);
    await expect(page.getByRole("status")).toContainText(`Krok 3 z ${total}`);

    // WHEN they walk ~200 m away from the route
    const [lon, lat] = steps[2].geometry.coordinates[0];
    const away: [number, number] = [lon, lat + 0.002];
    await context.setGeolocation(at(away));

    // THEN they are told and offered a route from where they are
    await expect(main).toContainText("Zboczyłeś z trasy");
    await expect(page.getByRole("status")).toContainText("Zboczyłeś z trasy");
    const reroute = page.getByRole("button", { name: "Wyznacz od nowa" });
    await expect(reroute).toHaveAccessibleDescription(/Pozycję wysyłamy do serwisu wyznaczania tras \(openrouteservice\) tylko w tym celu/);
    await evidence("route-guidance-off-route");

    // WHEN they ask for it
    const requested = page.waitForRequest((r) => r.url().endsWith("/api/v1/routes") && r.method() === "POST");
    await reroute.click();

    // THEN the new request starts at their position, and the start field says so (this server has no recorded
    // route from there, so guidance says the route can't be planned instead of showing the old one)
    expect((await requested).postDataJSON().from.coordinates).toEqual(away);
    await expect(main).toContainText("Twoja pozycja");
    await expect(main).toContainText("Tryb demonstracyjny: bez klucza openrouteservice");
  });
});

test("without location access guidance runs by hand, by keyboard", async ({ page, expectAccessible, evidence }) => {
  // GIVEN a browser that refuses location access
  await page.addInitScript(() => {
    navigator.geolocation.watchPosition = (_ok, fail) => {
      fail?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
      return 1;
    };
  });
  await openRoute(page);

  // WHEN a keyboard user starts guidance
  await page.getByRole("button", { name: "Ruszamy" }).focus();
  await page.keyboard.press("Enter");

  // THEN manual mode says why and starts on step 1 with "Poprzedni krok" disabled
  const main = page.locator("main");
  await expect(main).toContainText("Brak zgody na lokalizację. Przełączaj kroki");
  // The switch to manual mode repeats the current step, so it never replaces step 1 in the live region unheard.
  await expect(page.getByRole("status")).toContainText(/Brak zgody na lokalizację.*Krok 1 z 33/);
  await expect(main).toContainText("Krok 1 z 33");
  await expect(page.getByRole("button", { name: "Poprzedni krok" })).toBeDisabled();

  // WHEN they move on with "Następny krok"
  await page.getByRole("button", { name: "Następny krok" }).focus();
  await page.keyboard.press("Enter");

  // THEN step 2 is shown and read out, the next one is named, and the step's missing data carries its source
  await expect(main).toContainText("Krok 2 z 33");
  await expect(page.getByRole("status")).toContainText("Krok 2 z 33: Skręć w prawo, 257 m. Brak danych");
  await expect(main).toContainText(/Na tym odcinku: Brak danych/);
  await expectAccessible();
  await evidence("route-guidance-manual");

  // WHEN they go back a step
  await page.getByRole("button", { name: "Poprzedni krok" }).click();

  // THEN step 1 is current again
  await expect(main).toContainText("Krok 1 z 33");

  // WHEN they end guidance
  await page.getByRole("button", { name: "Zakończ" }).click();

  // THEN the route screen is back with focus on "Ruszamy"
  await expect(page.getByRole("button", { name: "Ruszamy" })).toBeFocused();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
});
