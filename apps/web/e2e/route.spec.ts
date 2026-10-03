import { expect, test } from "./fixtures";

// POST /routes hits the real handler; the e2e server runs without ORS_API_KEY (playwright.config.ts), so it answers
// from openrouteservice responses recorded for Dworzec Główny → Rynek Główny (src/server/routing/fixtures) — no
// network. Any other route behaves like an openrouteservice outage.

test("avoid-stairs route from Dworzec Główny to Rynek names the segments without data", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a visitor without a profile opening the route screen
  await page.goto("/trasa");
  const main = page.locator("main");

  // THEN the avoid-stairs route reports no known barriers, but always with the segments we know nothing about
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
  await expect(main).toContainText("Trasa nie zawiera znanych barier");
  await expect(main).toContainText("brak danych na 5 odcinkach (336 m)");
  await expect(main).toMatchAriaSnapshot({ name: "route-avoid-stairs.aria.yml" });
  await expectAccessible();
  await evidence("route-avoid-stairs");

  // WHEN a keyboard user opens the second step
  const step = page.getByRole("button", { name: /^Odcinek 2 z 33\. Skręć w prawo, 257 metrów\. Brak danych/ });
  await step.focus();
  await page.keyboard.press("Enter");

  // THEN its facts come with their source, date and reliability, and the missing part is named
  await expect(step).toHaveAttribute("aria-expanded", "true");
  const details = page.locator(`#${await step.getAttribute("aria-controls")}`);
  await expect(details).toContainText("Nawierzchnia dojścia: płyty chodnikowe");
  await expect(details).toContainText("OpenStreetMap (przez openrouteservice) · 3.10.2026 · społeczność");
  await expect(step).toContainText("brak danych o nawierzchni na części odcinka");

  // WHEN they switch to the shortest route
  await page.getByRole("button", { name: "Najkrótsza", exact: true }).click();

  // THEN the stairs in the underpass are listed as a barrier
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/13 min/);
  await expect(main).toContainText("Na trasie: schody");
  await expect(page.getByRole("button", { name: /^Odcinek 4 z 19\. .*Nie spełnia: schody/ })).toBeVisible();
  await evidence("route-shortest");
});

test("with the wheelchair profile the route keeps its limits and Floriańska shows as no data", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the route screen
  await page.goto("/trasa");
  await expect(page.locator("main")).toContainText("Trasa nie zawiera znanych barier");

  // WHEN the visitor picks the wheelchair profile
  await page.getByRole("radio", { name: "Wózek", exact: true }).check();

  // THEN the route is judged against the profile, incline included, and the unsurveyed street is not a pass
  await expect(page.locator("main")).toContainText("Ocena według progów profilu: wózek");
  await expect(page.locator("main")).toContainText("brak danych na 5 odcinkach (678 m)");
  await expect(page.getByRole("button", { name: /Floriańska.*346 metrów\. Brak danych: brak danych o nawierzchni/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Odcinek 1 z 24\..*Spełnia: płyty chodnikowe, płasko \(do 1%\)/ })).toBeVisible();
  await expectAccessible();
  await evidence("route-wheelchair");
});

test("a route without a routing key says so, offers the example route, and still shows the destination's entrance facts", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a place card
  await page.goto("/miejsca/kawiarnia-przyklad");
  await expect(page.getByRole("heading", { level: 1, name: "Kawiarnia Przykład" })).toBeVisible();

  // WHEN the visitor asks for a route to it (no recorded answer and no ORS key on this server)
  await page.getByRole("link", { name: "Prowadź" }).click();

  // THEN the route screen says this route can't be planned in demo mode, offers the example route (not a pointless retry), and still shows the entrance facts
  await expect(page).toHaveURL(/\/trasa\?do=kawiarnia-przyklad$/);
  const main = page.locator("main");
  await expect(main).toContainText("Tej trasy nie wyznaczymy w trybie demonstracyjnym");
  await expect(page.getByRole("link", { name: "Pokaż przykładową trasę" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Spróbuj ponownie" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: /Cel: wejście · Kawiarnia Przykład/ })).toBeVisible();
  await expect(main).toMatchAriaSnapshot({ name: "route-unavailable.aria.yml" });
  await expectAccessible();
  await evidence("route-unavailable");

  // WHEN they go back
  await page.getByRole("link", { name: "Wstecz" }).click();

  // THEN the rest of the app works: the card is there
  await expect(page.getByRole("heading", { level: 1, name: "Kawiarnia Przykład" })).toBeVisible();

  // WHEN they ask for the example route instead
  await page.getByRole("link", { name: "Prowadź" }).click();
  await page.getByRole("link", { name: "Pokaż przykładową trasę" }).click();

  // THEN the recorded Dworzec Główny → Rynek route opens
  await expect(page).toHaveURL(/\/trasa$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
});
