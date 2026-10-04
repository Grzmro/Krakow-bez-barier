import { expect, test } from "./fixtures";

// Departures come from the recorded ZTP feeds (TRANSIT_FEED=recorded in playwright.config.ts), answered as of the
// recording's time: 3.10.2026, 20:16.
const DEPARTURES = "**/api/v1/transit/departures**";

test("the place card lists the nearest departures with each vehicle's accessibility and the source", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a visitor opening a place by the Rynek
  await page.goto("/miejsca/palac-krzysztofory");
  const transit = page.getByRole("region", { name: "Najbliższe odjazdy" });

  // THEN the section says the data is a recording, not live, and names its source and time
  await expect(transit).toContainText("Nagranie danych przewoźnika z 3.10.2026, 20:16 — to nie są odjazdy na żywo.");
  await expect(transit).toContainText("Źródło: ZTP Kraków: GTFS i GTFS-Realtime · dane z 3.10.2026, 20:16");
  await expect(transit).toContainText("licencja: do potwierdzenia z urzędem");

  // AND the nearest stops list departures; trams read "Niezweryfikowane", never "dostępny"
  await expect(transit.getByRole("heading", { level: 3 }).first()).toBeVisible();
  const firstStop = transit.getByRole("listitem").first();
  await expect(firstStop.getByRole("listitem").first()).toContainText(/Tramwaj|Autobus/);
  await expect(transit).toContainText("Niezweryfikowane");
  await expect(transit).not.toContainText("Pojazd dostępny dla wózka");
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "place-transit.aria.yml" });

  await expectAccessible();
  await evidence("place-transit");
});

test("a feed outage shows the last data with its time", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the server answers with the last data it has while the operator is down
  await page.route(DEPARTURES, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.mode = "live";
    body.source.refreshStatus = "outage";
    await route.fulfill({ response, json: body });
  });

  // WHEN the card opens
  await page.goto("/miejsca/palac-krzysztofory");
  const transit = page.getByRole("region", { name: "Najbliższe odjazdy" });

  // THEN the outage is named with the data's time, and the departures stay
  await expect(transit).toContainText(
    "Dane przewoźnika są teraz niedostępne. Pokazujemy ostatnie pobrane, z 3.10.2026, 20:16.",
  );
  await expect(transit.getByRole("heading", { level: 3 }).first()).toBeVisible();
  await expectAccessible();
  await evidence("place-transit-outage");
});

test("a failing departures request doesn't break the card and can be retried by keyboard", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the departures endpoint fails
  await page.route(DEPARTURES, (route) => route.fulfill({ status: 503, contentType: "application/problem+json", body: "{}" }));

  // WHEN the card opens
  await page.goto("/miejsca/palac-krzysztofory");
  const transit = page.getByRole("region", { name: "Najbliższe odjazdy" });

  // THEN the rest of the card works and the section says what happened
  await expect(page.getByRole("heading", { level: 1, name: "Pałac Krzysztofory" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Fakty" })).toBeVisible();
  await expect(transit).toContainText("Nie udało się wczytać odjazdów. Reszta karty działa normalnie.");
  await expectAccessible();
  await evidence("place-transit-error");

  // WHEN the endpoint recovers and a keyboard user retries
  await page.unroute(DEPARTURES);
  await transit.getByRole("button", { name: "Spróbuj ponownie" }).focus();
  await page.keyboard.press("Enter");

  // THEN the departures appear
  await expect(transit.getByRole("heading", { level: 3 }).first()).toBeVisible();
});
