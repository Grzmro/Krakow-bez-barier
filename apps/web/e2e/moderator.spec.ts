import { MOCK_DEMO_TOKEN } from "../src/lib/mocks/mock-moderation";
import { expect, test } from "./fixtures";

// The client runs in mock mode: the queue starts from the spec's example (Podziemia Rynku, Hotel Przykład)
// and decisions change it in memory; the real API behind it is covered by the route tests of KBB-19.

for (const lang of ["pl", "en"]) {
  test(`the phone menu (${lang}) has no link to the internal moderator panel`, async ({ page, context, baseURL }) => {
    // GIVEN the home screen on a phone in the given language
    if (lang === "en") await context.addCookies([{ name: "kbb-lang", value: "en", url: baseURL! }]);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", lang);

    // WHEN the visitor opens the menu
    await page.getByRole("button", { name: "Menu" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("link").first()).toBeVisible();

    // THEN no link leads to /moderator
    await expect(drawer.getByRole("link", { name: /moderator/i })).toHaveCount(0);
    await expect(page.locator('a[href="/moderator"]')).toHaveCount(0);
  });
}

test("a moderator signs in with a pasted token, no puzzle, and the empty field is explained", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the moderator panel opened by its direct address, as it isn't linked from the public navigation
  await page.goto("/moderator");
  await expect(page.getByRole("heading", { level: 1, name: "Panel moderatora" })).toBeVisible();
  const main = page.locator("main");
  const token = page.getByLabel("Token moderatora");
  await expect(main).toMatchAriaSnapshot({ name: "moderator-sign-in.aria.yml" });
  await expectAccessible();

  // WHEN the moderator sends the form without a token
  await page.getByRole("button", { name: "Zaloguj" }).click();

  // THEN the error is in text, the field is invalid and keeps focus
  await expect(main).toContainText("Wpisz token moderatora.");
  await expect(token).toHaveAttribute("aria-invalid", "true");
  await expect(token).toBeFocused();
  await expect(token).toHaveAttribute("autocomplete", "current-password");
  await expectAccessible();
  await evidence("moderator-sign-in");

  // WHEN a token is pasted and sent with Enter
  await token.fill("demo-token-1234567890");
  await page.keyboard.press("Enter");

  // THEN the queue is shown and announced
  await expect(page.getByRole("heading", { name: "Kolejka zgłoszeń (2)" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Kolejka zgłoszeń: 2 do decyzji." })).toBeAttached();
});

test("approving a report from the keyboard moves it from the queue to the history", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a signed-in moderator
  await page.goto("/moderator");
  await page.getByLabel("Token moderatora").fill("demo-token-1234567890");
  await page.getByRole("button", { name: "Zaloguj" }).click();
  const main = page.locator("main");
  await expect(page.getByRole("heading", { name: "Kolejka zgłoszeń (2)" })).toBeVisible();

  // THEN the first report is previewed: what the card says now with its source and date, and what it will say
  await expect(page.getByRole("heading", { name: "Podziemia Rynku · Winda" })).toBeVisible();
  await expect(main).toContainText("TerazJestOpenStreetMap · 14.05.2026");
  await expect(main).toContainText("Po zatwierdzeniuNie ma");
  await expect(main).toContainText("Źródło: Społeczność, zweryfikowane przez moderatora");
  // AND the earlier "Do wyjaśnienia" decision on the hotel report is in the history with who and when
  const history = page.locator("section").filter({ has: page.getByRole("heading", { name: "Historia zmian" }) });
  // AND a decision other than approval shows what was reported, not a change
  await expect(history).toContainText("Hotel Przykład · Szerokość drzwi · zgłoszono: 90 cm");
  await expect(history).toContainText("anna ·");
  await expect(main).toMatchAriaSnapshot({ name: "moderator-queue.aria.yml" });
  await expectAccessible();
  await evidence("moderator-queue");

  // WHEN a note typed for one report is left behind by opening another
  const note = page.getByLabel("Notatka do decyzji (opcjonalnie)");
  await note.fill("Notatka do hotelu");
  await page.getByRole("button", { name: /^Hotel Przykład/ }).click();

  // THEN the other report starts with an empty note
  await expect(page.getByRole("heading", { name: "Hotel Przykład · Szerokość drzwi" })).toBeVisible();
  await expect(note).toHaveValue("");

  // WHEN the moderator goes back, adds a note and approves with the keyboard
  await page.getByRole("button", { name: /^Podziemia Rynku/ }).click();
  await note.fill("Sprawdzone na miejscu.");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Zatwierdź" })).toBeFocused();
  await page.keyboard.press("Enter");

  // THEN the decision is announced, the report leaves the queue and focus returns to the queue heading
  // (mock mode says the place card does not change)
  await expect(page.getByRole("status").filter({ hasText: /^Zatwierdzone \(tryb przykładowy/ })).toBeAttached();
  const queueHeading = page.getByRole("heading", { name: "Kolejka zgłoszeń (1)" });
  await expect(queueHeading).toBeFocused();
  await expect(page.getByRole("heading", { name: "Podziemia Rynku · Winda" })).toHaveCount(0);
  // AND the history records it first, with the moderator, the note and the decision
  const first = history.getByRole("listitem").first();
  await expect(first).toContainText("Podziemia Rynku · Winda → Nie ma");
  await expect(first).toContainText("demo ·");
  await expect(first).toContainText("Sprawdzone na miejscu.");
  await expect(first).toContainText("Zatwierdzone");

  // WHEN the remaining report is rejected
  await page.getByRole("button", { name: "Odrzuć" }).click();

  // THEN the queue is empty and the rejection is in the history
  await expect(page.getByRole("heading", { name: "Kolejka zgłoszeń (0)" })).toBeVisible();
  await expect(main).toContainText("Kolejka jest pusta");
  await expect(history.getByRole("listitem").first()).toContainText("Odrzucone");
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 8_000 });
  await expectAccessible();
  await evidence("moderator-decided");
});

test("the demo account is clearly marked and says when its decisions are undone", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the panel signed in with the demo account's token (the mock's stand-in for MODERATOR_DEMO_TOKEN)
  await page.goto("/moderator");
  await page.getByLabel("Token moderatora").fill(MOCK_DEMO_TOKEN);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Kolejka zgłoszeń (2)" })).toBeVisible();

  // THEN a notice names the account and explains that its decisions are real but undone after 30 minutes
  const notice = page.getByRole("complementary", { name: "Konto demonstracyjne" });
  await expect(notice).toContainText("Po 30 min każdą decyzję tego konta cofamy automatycznie");
  await expect(notice).toMatchAriaSnapshot({ name: "moderator-demo-notice.aria.yml" });
  // AND the preview names the temporary demo source the approval will use
  await expect(page.getByRole("main")).toContainText("Źródło: Konto demonstracyjne moderatora (zmiana tymczasowa)");
  await expectAccessible();
  await evidence("moderator-demo");

  // WHEN the demo account approves the first report
  await page.getByRole("button", { name: "Zatwierdź" }).click();

  // THEN the history records it under the demo account's name with a link to the place card
  const history = page.locator("section").filter({ has: page.getByRole("heading", { name: "Historia zmian" }) });
  const first = history.getByRole("listitem").first();
  await expect(first).toContainText("Podziemia Rynku · Winda → Nie ma");
  await expect(first).toContainText("Konto demonstracyjne ·");
  await expect(first.getByRole("link", { name: "Zobacz na karcie: Podziemia Rynku" })).toHaveAttribute(
    "href",
    "/miejsca/podziemia-rynku",
  );
  await expectAccessible();
});

test("the jury enters the demo account with one click, no token to paste", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the sign-in screen of a server with a demo account (the example-data mode stands in for one)
  await page.goto("/moderator");
  const entry = page.getByRole("region", { name: "Dla jury i do wypróbowania" });
  await expect(entry).toContainText("po 30 min cofamy je automatycznie");
  await expect(entry).toMatchAriaSnapshot({ name: "moderator-demo-entry.aria.yml" });
  await expectAccessible();
  await evidence("moderator-demo-entry");

  // WHEN the button is reached and pressed with the keyboard
  const button = page.getByRole("button", { name: "Wejdź na konto demonstracyjne (dla jury)" });
  await button.focus();
  await page.keyboard.press("Enter");

  // THEN the panel opens on the demo account, announced, without anything typed into the token field
  await expect(page.getByRole("heading", { name: "Kolejka zgłoszeń (2)" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Konto demonstracyjne" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Kolejka zgłoszeń: 2 do decyzji." })).toBeAttached();
  await expectAccessible();
});

test("the session survives a reload and ends with Wyloguj", async ({ page }) => {
  // GIVEN a signed-in moderator
  await page.goto("/moderator");
  await page.getByLabel("Token moderatora").fill("demo-token-1234567890");
  await page.getByRole("button", { name: "Zaloguj" }).click();
  await expect(page.getByRole("heading", { name: "Kolejka zgłoszeń (2)" })).toBeVisible();

  // WHEN the page is reloaded
  await page.reload();

  // THEN the queue is shown without signing in again
  await expect(page.getByRole("heading", { name: "Kolejka zgłoszeń (2)" })).toBeVisible();

  // WHEN the moderator signs out
  await page.getByRole("button", { name: "Wyloguj" }).click();

  // THEN the sign-in form is back
  await expect(page.getByRole("main")).toContainText("Wylogowano.");
  await expect(page.getByLabel("Token moderatora")).toBeVisible();
});

test("a moderator removes a false outage from the Awarie tab, keyboard only", async ({ page, expectAccessible, evidence }) => {
  // GIVEN a signed-in moderator (the mock lists the spec's two example outages)
  await page.goto("/moderator");
  await page.getByLabel("Token moderatora").fill("demo-token-1234567890");
  await page.keyboard.press("Enter");
  const reportsTab = page.getByRole("tab", { name: "Zgłoszenia (2)" });
  await expect(reportsTab).toHaveAttribute("aria-selected", "true");

  // WHEN the moderator moves to the "Awarie" tab with the arrow key
  await reportsTab.focus();
  await page.keyboard.press("ArrowRight");
  const outagesTab = page.getByRole("tab", { name: "Awarie (2)" });
  await expect(outagesTab).toBeFocused();
  await page.keyboard.press("Enter");

  // THEN every active outage is listed with its place, equipment, votes and time
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("heading", { name: "Aktywne awarie (2)" })).toBeVisible();
  const hotel = panel.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Hotel Przykład · Winda" }) });
  await expect(hotel).toContainText("Potwierdzona przez społeczność");
  await expect(hotel).toContainText("2 potwierdzenia · „Działa”: 0 · Zgłoszona");
  await expect(panel).toContainText("Podziemia Rynku · Podjazd");
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "moderator-outages.aria.yml" });
  await expectAccessible();
  await evidence("moderator-outages");

  // WHEN the ramp outage is removed with the keyboard
  const remove = panel.getByRole("button", { name: "Usuń awarię: Podziemia Rynku · Podjazd" });
  await remove.focus();
  await page.keyboard.press("Enter");

  // THEN the removal is announced, the outage leaves the list and focus returns to the list heading
  await expect(page.getByRole("status").filter({ hasText: /^Usunięto \(tryb przykładowy/ })).toBeAttached();
  await expect(page.getByRole("heading", { name: "Aktywne awarie (1)" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Awarie (1)" })).toBeVisible();
  await expect(remove).toHaveCount(0);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 8_000 });
  await expectAccessible();
});

/** Opens the "Demo źródeł" tab, signing in with the one-click demo account unless this tab's session already is. */
async function openSourceDemo(page: import("@playwright/test").Page) {
  await page.goto("/moderator");
  const tab = page.getByRole("tab", { name: "Demo źródeł" });
  const demo = page.getByRole("button", { name: "Wejdź na konto demonstracyjne (dla jury)" });
  await expect(tab.or(demo)).toBeVisible();
  if (await demo.isVisible()) await demo.click();
  await tab.click();
  return page.getByRole("tabpanel", { name: "Demo źródeł" });
}

test("the demo account simulates a source outage: O danych shows it failed, labelled as a demo", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the jury on the demo account, in the "Demo źródeł" tab, with no simulation running
  const panel = await openSourceDemo(page);
  await expect(panel).toContainText("Żadna symulacja nie trwa");

  // WHEN OpenStreetMap is picked and the outage switched on from the keyboard
  await panel.getByLabel("Źródło").selectOption({ label: "OpenStreetMap" });
  await panel.getByRole("button", { name: "Symuluj awarię" }).focus();
  await page.keyboard.press("Enter");

  // THEN it is announced with its end time and listed with a switch-off button
  await expect(page.getByRole("status").filter({ hasText: /^Symulacja awarii włączona: OpenStreetMap\. Wyłączy się sama o / })).toBeAttached();
  await expect(panel).toContainText("OpenStreetMap · symulowana awaria");
  await expect(panel).toContainText("włączył(a): Konto demonstracyjne");
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "moderator-source-outages.aria.yml" });
  await expectAccessible();
  await evidence("moderator-source-outages");

  // WHEN O danych is opened
  await page.getByRole("link", { name: "Zobacz w „O danych”" }).click();

  // THEN OpenStreetMap reads as failed, with its last data date and the demo label; nothing else changed
  const osm = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "OpenStreetMap" }) });
  await expect(osm).toContainText(/Odświeżenie nie powiodło się — dane z /);
  await expect(osm).toContainText("Tryb demo");
  await expect(osm.locator("[data-refresh-status]")).toHaveAttribute("data-refresh-status", "outage");
  await expectAccessible();
  await evidence("about-data-simulated-outage");
});

test("a simulated outage marks the card's facts as possibly outdated and switching it off restores the card", async ({
  page,
}) => {
  // GIVEN the demo account switched on the OpenStreetMap outage
  const panel = await openSourceDemo(page);
  await panel.getByLabel("Źródło").selectOption({ label: "OpenStreetMap" });
  await panel.getByRole("button", { name: "Symuluj awarię" }).click();
  await expect(panel).toContainText("OpenStreetMap · symulowana awaria");

  // WHEN the palace card is opened
  await page.goto("/miejsca/palac-krzysztofory");

  // THEN the card shows OpenStreetMap failed with its data date, labelled as a demo, and its facts still listed
  const main = page.locator("main");
  await expect(main).toContainText("Odświeżenie nie powiodło się — dane z 3.10.2026");
  const banner = main.locator("p").filter({ hasText: "Źródło: OpenStreetMap" });
  await expect(banner).toContainText("Tryb demo");

  // WHEN the outage is switched off in the panel
  const again = await openSourceDemo(page);
  await again.getByRole("button", { name: "Wyłącz symulowaną awarię: OpenStreetMap" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Symulacja wyłączona: OpenStreetMap/ })).toBeAttached();
  await expect(again).toContainText("Żadna symulacja nie trwa");

  // THEN the card is back to its own state
  await page.goto("/miejsca/palac-krzysztofory");
  await expect(page.getByRole("heading", { level: 1, name: "Pałac Krzysztofory" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Odświeżenie nie powiodło się — dane z 3.10.2026");
});
