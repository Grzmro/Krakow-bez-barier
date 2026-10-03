import { expect, test } from "./fixtures";

// Demo cases come from the openapi.yaml examples served by the mock API (TODO(KBB-28)).

test("conflicting data and an unavailable source are both visible on the card", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a visitor without an account or profile opening a shared link
  await page.goto("/miejsca/palac-krzysztofory");
  const main = page.locator("main");

  // THEN the card shows the place, the failed-refresh banner and the conflict warning
  await expect(page.getByRole("heading", { level: 1, name: "Pałac Krzysztofory" })).toBeVisible();
  await expect(main).toContainText("Odświeżenie nie powiodło się — dane z 8.11.2023");
  await expect(main).toContainText("Źródła podają sprzeczne dane");
  await expect(main).toMatchAriaSnapshot({ name: "place-conflict.aria.yml" });

  // WHEN a keyboard user opens the toilet fact
  const toilet = page.getByRole("button", { name: /Toaleta dostosowana/ });
  await expect(toilet).toContainText("Jest / Nie ma");
  await expect(toilet).toContainText("Sprzeczne");
  await toilet.focus();
  await page.keyboard.press("Enter");

  // THEN both sources are listed with their values and the stale one is flagged
  await expect(toilet).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator(`#${await toilet.getAttribute("aria-controls")}`);
  await expect(panel).toContainText("Źródło: Toalety publiczne — MSIP Kraków (dane ISDP) · Jest");
  await expect(panel).toContainText("Źródło: OpenStreetMap · Nie ma");
  await expect(panel).toContainText("Może być nieaktualne · 8.11.2023");

  await expectAccessible();
  await evidence("place-conflict");
});

test("an incomplete place names missing data and offers contact and Uzupełnij", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the incomplete demo place
  await page.goto("/miejsca/kawiarnia-przyklad");
  const main = page.locator("main");
  await expect(page.getByRole("heading", { level: 1, name: "Kawiarnia Przykład" })).toBeVisible();

  // THEN every fact reads "Brak danych" as text, never as accessible
  await expect(page.getByRole("button", { name: /Winda.*Brak danych/ })).toBeVisible();
  await expect(main).toContainText("Nie mamy jeszcze żadnego źródła dla tego miejsca.");
  await expect(main).toMatchAriaSnapshot({ name: "place-incomplete.aria.yml" });

  // WHEN a keyboard user asks the venue from the "Czegoś nie wiadomo?" box
  await page.getByRole("button", { name: "Zapytaj obiekt" }).last().focus();
  await page.keyboard.press("Enter");

  // THEN focus moves to the contact details and the sample phone is shown as a link marked PRZYKŁAD
  const contact = page.locator("#place-contact");
  await expect(contact).toBeFocused();
  await expect(contact.getByRole("link", { name: "+48 12 000 00 00" })).toBeVisible();
  await expect(contact).toContainText("Przykład");

  await expectAccessible();
  await evidence("place-incomplete");
});

test("an outdated fact says it may be outdated, with its date", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the outdated demo place
  await page.goto("/miejsca/teatr-slowackiego");

  // WHEN the ramp fact is expanded
  const ramp = page.getByRole("button", { name: /Podjazd/ });
  await expect(ramp).toContainText("Nieaktualne");
  await ramp.click();

  // THEN the source, its date and the staleness note are visible
  await expect(page.locator("main")).toContainText("Może być nieaktualne · 10.05.2022");
  await expectAccessible();
  await evidence("place-outdated");
});

test("an unavailable source keeps its last data, marked as outdated", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the demo place whose only source is in outage
  await page.goto("/miejsca/podziemia-rynku");
  await expect(page.getByRole("heading", { level: 1, name: "Podziemia Rynku" })).toBeVisible();

  // THEN the failed-refresh banner names the source and the date of the last good data
  const main = page.locator("main");
  await expect(main).toContainText("Odświeżenie nie powiodło się — dane z 8.11.2023");
  await expect(main).toContainText("Źródło: Toalety publiczne — MSIP Kraków (dane ISDP)");
  await expect(main).not.toContainText("Źródła podają sprzeczne dane");

  // WHEN the toilet fact is expanded
  await page.getByRole("button", { name: /Toaleta dostosowana/ }).click();

  // THEN the last known value is shown with its staleness note
  await expect(main).toContainText("Może być nieaktualne · 8.11.2023");
  await expectAccessible();
  await evidence("place-source-unavailable");
});

test("Udostępnij copies the permanent link to the card", async ({ page, context }) => {
  // GIVEN a browser that allows clipboard access
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/miejsca/palac-krzysztofory");

  // WHEN the visitor shares the card
  await page.getByRole("button", { name: "Udostępnij" }).click();

  // THEN the stable /miejsca/{id} link is in the clipboard, the toast confirms it and it is announced
  await expect(page.locator("[data-sonner-toast]").getByText("Link do karty skopiowany")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Link do karty skopiowany" })).toBeAttached();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(copied).pathname).toBe("/miejsca/palac-krzysztofory");
});

test("an unknown place shows a not-found message", async ({ page }) => {
  // GIVEN a link to a place that doesn't exist
  await page.goto("/miejsca/nie-ma-takiego");

  // THEN the visitor is told so and can go back to search
  await expect(page.getByRole("heading", { level: 1, name: "Nie znaleźliśmy tego miejsca" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Wróć do wyszukiwania" })).toBeVisible();
});
