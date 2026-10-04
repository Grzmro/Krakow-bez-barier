import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";

// The client runs in mock mode: the statistics are computed by the same aggregation the API runs, over the spec's
// example places and the mock moderation queue. The API behind it is covered by the route tests.

const TOKEN = "demo-token-1234567890";

test("the city panel shows statistics and the priority ranking, keyboard-reachable and exportable", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the city panel opened from the menu
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: /Panel dla miasta/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Panel dla miasta" })).toBeVisible();
  const main = page.locator("main");
  await expect(main).toContainText("tego samego logowania co panel moderatora");

  // WHEN a moderator token is pasted and sent with Enter
  await page.getByLabel("Token moderatora").fill(TOKEN);
  await page.keyboard.press("Enter");

  // THEN the statistics are announced and shown as text: tiles, the per-need table and reports by status
  await expect(page.getByRole("status").filter({ hasText: /^Statystyki gotowe: \d+ miejsc/ })).toBeAttached();
  await expect(main).toContainText("Tryb przykładowy: statystyki policzone z przykładowych miejsc");
  // AND in sample mode it doesn't claim the numbers come from real sources, and it says which categories are left out
  await expect(main).not.toContainText("dane z OpenStreetMap");
  await expect(main).toContainText("oprócz kategorii ukrytych domyślnie na mapie (miejsca postojowe, przystanki)");
  const needs = page.getByRole("table", { name: "Liczba miejsc według wyniku dla każdej potrzeby" });
  await expect(needs.getByRole("rowheader")).toHaveText(["Wejście", "Drzwi", "Winda", "Toaleta dostosowana", "Nawierzchnia"]);
  const reports = page.getByRole("table", { name: "Liczba zgłoszeń według statusu" });
  await expect(reports.getByRole("row", { name: /Oczekuje/ })).toContainText("1");
  await expect(reports.getByRole("row", { name: /Do wyjaśnienia/ })).toContainText("1");

  // AND the GUS context gives each figure its census year or year, BDL variable, licence and fetch date
  await expect(page.getByRole("heading", { name: "Kraków w statystyce GUS" })).toBeVisible();
  await expect(main).toContainText(/Osoby z niepełnosprawnością\s*111\s014\s*Narodowy Spis Powszechny 2021 · zmienna BDL 1701558/);
  await expect(main).toContainText(/34 z 45\s*2025 · zmienne BDL 1610486 i 1241/);
  await expect(main).toContainText(/Źródło: GUS, Bank Danych Lokalnych, licencja CC BY 4\.0\. Pobrano \d+\.\d+\.\d{4}\./);

  // AND the ranking explains its criteria and lists places with their action and reasons
  await expect(main).toContainText("+4 pkt za każdą potrzebę ze znaną barierą");
  await expect(main).toContainText("Nie mamy danych o liczbie odwiedzin");
  const ranking = page.getByRole("table", { name: /^Pierwsze \d+ z \d+ miejsc/ });
  const rows = ranking.locator("tbody tr");
  await expect(rows.first()).toContainText("Naprawa");
  await expect(ranking).toContainText("1 zgłoszenie do decyzji (+3)");
  await expect(main).toMatchAriaSnapshot({ name: "city-panel.aria.yml" });
  await expectAccessible();
  await evidence("city-panel");

  // WHEN the ranking is reached with the keyboard
  await page.getByRole("button", { name: "Pobierz CSV" }).focus();
  await page.keyboard.press("Tab");

  // THEN the scrollable table takes focus, and the next Tab reaches the first place's card link
  await expect(page.getByRole("region", { name: "Tabela priorytetów (przewijana poziomo)" })).toBeFocused();
  await page.keyboard.press("Tab");
  const firstLink = rows.first().getByRole("link");
  await expect(firstLink).toBeFocused();
  const firstName = (await firstLink.textContent()) ?? "";

  // WHEN the ranking is downloaded as CSV
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Pobierz CSV" }).click(),
  ]);

  // THEN the file has the header and the first place, and the download is announced
  expect(download.suggestedFilename()).toMatch(/^priorytety-dostepnosci-krakow-top-\d+-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile((await download.path())!, "utf8");
  const [header, first] = csv.replace(/^﻿/, "").split("\r\n");
  expect(header).toBe("Nr;Miejsce;Kategoria;Punkty;Działanie;Powody;Zgłoszenia do decyzji;Długość;Szerokość;Identyfikator");
  expect(first).toContain(`1;${firstName};`);
  await expect(page.getByRole("status").filter({ hasText: /^Pobrano plik CSV: cały ranking, \d+ miejsc/ })).toBeAttached();

  // WHEN the first place is opened from the ranking with Enter
  await firstLink.focus();
  await page.keyboard.press("Enter");

  // THEN its card opens
  await expect(page.getByRole("heading", { level: 1, name: firstName })).toBeVisible();
});

test("the jury enters the city panel with the demo account in one click", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the city panel's sign-in screen on a server with a demo account (the example-data mode stands in for one)
  await page.goto("/miasto");
  const entry = page.getByRole("region", { name: "Dla jury i do wypróbowania" });
  await expect(entry).toContainText("po 30 min cofamy je automatycznie");
  await expect(entry).toMatchAriaSnapshot({ name: "city-demo-entry.aria.yml" });
  await expectAccessible();
  await evidence("city-demo-entry");

  // WHEN the button is reached and pressed with the keyboard
  await page.getByRole("button", { name: "Wejdź na konto demonstracyjne (dla jury)" }).focus();
  await page.keyboard.press("Enter");

  // THEN the statistics open, announced, without a token typed in
  await expect(page.getByRole("status").filter({ hasText: /^Statystyki gotowe: \d+ miejsc/ })).toBeAttached();
  await expect(page.getByRole("heading", { name: "Priorytety napraw i uzupełnień" })).toBeVisible();
});

test("one sign-in covers the moderator panel and the city panel", async ({ page }) => {
  // GIVEN a moderator signed in on the city panel
  await page.goto("/miasto");
  await page.getByLabel("Token moderatora").fill(TOKEN);
  await page.getByRole("button", { name: "Zaloguj" }).click();
  await expect(page.getByRole("heading", { name: "Priorytety napraw i uzupełnień" })).toBeVisible();

  // WHEN the moderator panel is opened in the same tab
  await page.goto("/moderator");

  // THEN the queue is shown without signing in again
  await expect(page.getByRole("heading", { name: "Kolejka zgłoszeń (2)" })).toBeVisible();

  // WHEN the moderator signs out there and returns to the city panel
  await page.getByRole("button", { name: "Wyloguj" }).click();
  await page.goto("/miasto");

  // THEN the city panel asks for the token again
  await expect(page.getByLabel("Token moderatora")).toBeVisible();
});

test.describe("on a desktop screen", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the city panel lays the tiles and the ranking out wide", async ({ page, expectAccessible, evidence }) => {
    // GIVEN a signed-in moderator on a desktop screen
    await page.goto("/miasto");
    await page.getByLabel("Token moderatora").fill(TOKEN);
    await page.keyboard.press("Enter");

    // THEN the ranking table is visible and the page passes axe
    await expect(page.getByRole("table", { name: /^Pierwsze \d+ z \d+ miejsc/ })).toBeVisible();
    await expectAccessible();
    await evidence("city-panel-desktop");
  });
});
