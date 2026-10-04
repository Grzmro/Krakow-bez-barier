import { expect, test } from "./fixtures";

// Places come from the openapi.yaml examples served by the mock API.

const EVENT_PATH = "/wydarzenie/palac-krzysztofory?nazwa=Koncert+jesienny&data=2026-10-10";

test("an organizer generates an event link and it opens the event page without an account", async ({ page, context }) => {
  // GIVEN an organizer on the business page
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/dla-firm");
  const generator = page.getByRole("region", { name: "Link do strony wydarzenia" });

  // THEN before any search the preselected venue is the best-documented one near the Rynek, not the first listed
  const venue = page.getByRole("combobox", { name: "Miejsce wydarzenia" });
  await expect(venue).toHaveText("Hotel Przykład (PRZYKŁAD)");
  await venue.click();
  await expect(page.getByRole("option").first()).toHaveText("Podziemia Rynku (PRZYKŁAD)");
  await page.keyboard.press("Escape");

  // WHEN they find the venue, name the event and pick the date
  await page.getByRole("searchbox", { name: "Szukaj miejsca" }).fill("Krzysztof");
  await expect(venue).toHaveText("Pałac Krzysztofory (PRZYKŁAD)");
  await page.getByRole("textbox", { name: "Nazwa wydarzenia" }).fill("Koncert jesienny");
  await page.getByLabel("Data wydarzenia").fill("2026-10-10");

  // THEN the link carries the place, name and date, and copying it puts it in the clipboard
  const origin = new URL(page.url()).origin;
  await expect(generator).toHaveText(`${origin}${EVENT_PATH}`);
  await page.getByRole("button", { name: "Kopiuj link do strony wydarzenia" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${origin}${EVENT_PATH}`);

  // WHEN they open the preview
  const [eventPage] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("link", { name: /Podgląd strony wydarzenia/ }).click(),
  ]);

  // THEN the event page shows the event, the venue and facts with their sources and dates
  const main = eventPage.locator("main");
  await expect(main.getByRole("heading", { level: 1, name: "Koncert jesienny" })).toBeVisible();
  await expect(main).toContainText("Pałac Krzysztofory");
  await expect(main).toContainText("sobota, 10 października 2026");
  const entrance = main.getByRole("list", { name: "Wejście" });
  await expect(entrance.getByRole("listitem").filter({ hasText: "Wejście — stopnie" }).first()).toContainText(
    /Bez stopni.*OpenStreetMap · /,
  );
  // AND a conflict shows both values with their sources, and missing data is named as missing
  const toilet = main.getByRole("list", { name: "Toaleta" });
  await expect(toilet.getByRole("listitem").filter({ hasText: "Toaleta dostosowana" }).first()).toContainText(
    /Jest — .*Nie ma — /,
  );
  await expect(main.getByRole("list", { name: "Parking" })).toContainText(/Brak danych:.*Nikt jeszcze tego nie sprawdził/);
  await expect(main.getByRole("heading", { name: "Źródła danych" })).toBeVisible();
  // AND a source that is down says so next to its last fetch, and the free-text name is attributed
  await expect(main.getByRole("region", { name: "Źródła danych" })).toContainText(/MSIP: Toalety publiczne · .* · źródło niedostępne/);
  await expect(main).toContainText("Nazwę i termin podał organizator.");
});

test("the event page is accessible, keyboard-operable and prints without the app chrome", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the event link opened directly, as a participant gets it
  await page.goto(EVENT_PATH);
  const main = page.locator("main");
  await expect(main.getByRole("heading", { level: 1, name: "Koncert jesienny" })).toBeVisible();
  await expect(main.getByRole("list", { name: "Dostępność przystanku Plac Wszystkich Świętych 01" })).toBeVisible();
  await expect(main).toMatchAriaSnapshot({ name: "event-page.aria.yml" });
  await expectAccessible();
  await evidence("event-page");

  // WHEN a keyboard user moves to the actions
  const fullCard = page.getByRole("link", { name: "Pełna karta miejsca" });
  await fullCard.focus();
  await page.keyboard.press("Tab");

  // THEN the print button follows the full card link
  await expect(page.getByRole("button", { name: "Drukuj" })).toBeFocused();
  await expect(fullCard).toHaveAttribute("href", "/miejsca/palac-krzysztofory");

  // WHEN the page is printed
  await page.emulateMedia({ media: "print" });

  // THEN the header and buttons are gone and the full card's address is written out instead
  await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Drukuj" })).toBeHidden();
  await expect(main.getByText(/Pełna karta i zgłaszanie zmian: http.*\/miejsca\/palac-krzysztofory/)).toBeVisible();
  await expect(main.getByText("PRZYKŁAD").first()).toBeVisible();
  await evidence("event-page-print");
});

test("the event page lists the stop within walking distance with its platform facts, source and date", async ({ page, evidence }) => {
  // GIVEN the event page of Pałac Krzysztofory (the example stop Plac Wszystkich Świętych 01 is ~350 m away,
  // Rondo Mogilskie 07 ~1.6 km)
  await page.goto(EVENT_PATH);
  const stops = page.getByRole("region", { name: "Przystanki w pobliżu" });

  // THEN only the stop in reach is listed, with its distance and a link to its card
  await expect(stops.getByRole("heading", { level: 3 })).toHaveCount(1);
  await expect(stops.getByRole("heading", { level: 3 })).toContainText(/Plac Wszystkich Świętych 01\s*\d{3} m od miejsca/);
  await expect(stops.getByRole("link", { name: "Plac Wszystkich Świętych 01" })).toHaveAttribute(
    "href",
    "/miejsca/przystanek-plac-wszystkich-swietych-01",
  );
  await expect(stops).not.toContainText("Rondo Mogilskie");
  // AND each platform fact names OpenStreetMap and its date; an untagged one is "Brak danych", never a pass
  const facts = stops.getByRole("list", { name: "Dostępność przystanku Plac Wszystkich Świętych 01" });
  await expect(facts.getByRole("listitem").filter({ hasText: "Oznaczenia dotykowe" }).first()).toContainText(
    /Nie ma.*OpenStreetMap · 4\.10\.2026/,
  );
  await expect(facts.getByRole("listitem").filter({ hasText: "Wiata" }).first()).toContainText("Jest");
  await expect(facts.getByRole("listitem").filter({ hasText: "Ogólna dostępność" })).toContainText(
    /Brak danych:.*Ogólna dostępność.*Nikt jeszcze tego nie sprawdził/,
  );
  await expect(facts.getByRole("listitem").last()).toContainText("Brak danych:");
  await evidence("event-page-stops");
});

test("with no stop data in reach the event page says so, without inventing a stop", async ({ page }) => {
  // GIVEN the event page of a venue in Kazimierz, over 1 km from both example stops
  await page.goto("/wydarzenie/muzeum-inzynierii-i-techniki");
  const stops = page.getByRole("region", { name: "Przystanki w pobliżu" });

  // THEN the card says there is no stop data within 400 m, and that this is not "no stop"
  await expect(stops).toContainText("Brak danych o przystankach w promieniu 400 m od miejsca. To nie znaczy, że w pobliżu nie ma przystanku.");
  await expect(stops.getByRole("heading", { level: 3 })).toHaveCount(0);
});

test("an event link to an unknown place says so", async ({ page }) => {
  // GIVEN a broken event link
  await page.goto("/wydarzenie/nie-ma-takiego?nazwa=Koncert");

  // THEN the page says the place wasn't found instead of showing another place
  await expect(page.getByRole("heading", { level: 1, name: "Nie znaleźliśmy tego miejsca" })).toBeVisible();
});
