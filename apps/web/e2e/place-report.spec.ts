import { expect, test } from "./fixtures";

// Reports and confirmations go to the mock API (spec examples) until KBB-19 serves them.

test("a keyboard-only visitor reports a wrong value in three steps; the card keeps its data", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the conflicting demo place, toilet fact left collapsed
  await page.goto("/miejsca/palac-krzysztofory");
  const toilet = page.getByRole("button", { name: /Toaleta dostosowana/ });
  const row = page.locator("li").filter({ has: toilet });
  await expect(toilet).toHaveAttribute("aria-expanded", "false");

  // WHEN the visitor presses "To się nie zgadza" (1), picks a value (2) and sends (3), keyboard only
  await toilet.focus();
  await page.keyboard.press("Tab");
  await expect(row.getByRole("button", { name: "To się nie zgadza" })).toBeFocused();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "To się nie zgadza" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("radio", { name: "Toaleta dostosowana" })).toBeChecked();
  await expect(drawer.getByRole("radio", { name: "Jest dostosowana" })).toBeFocused();
  await expect(drawer).toMatchAriaSnapshot({ name: "place-report-form.aria.yml" });
  await expectAccessible();
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");

  // THEN the drawer closes, the thank-you toast offers "Cofnij" and the report shows as unverified with a date
  await expect(drawer).toBeHidden();
  await expect(page.locator("[data-sonner-toast]").getByText("Dzięki! Czeka na weryfikację.")).toBeVisible();
  await expect(row).toContainText("Twoje zgłoszenie:Jest");
  await expect(row).toContainText("Niezweryfikowane");
  await expect(row).toContainText("Czeka na weryfikację — nie zmienia danych powyżej.");
  // AND the fact itself still reads as the unresolved conflict
  await expect(toilet).toContainText("Jest / Nie ma");
  await expect(toilet).toContainText("Sprzeczne");
  // AND after the undo window the report is sent and dated by the server
  await expect(row).not.toContainText("wysyłanie", { timeout: 8_000 });
  await expect(row).toContainText(new Intl.DateTimeFormat("pl-PL").format(new Date()));
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "place-report-sent.aria.yml" });

  // Sonner's exit animation fades the toast text, which axe would flag as low contrast.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await expectAccessible();
  await evidence("place-report-sent");
});

test("a number out of the contract's range is explained in text and not sent", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the incomplete demo place, filling in the door width from the "Czegoś nie wiadomo?" box
  await page.goto("/miejsca/kawiarnia-przyklad");
  await page.getByRole("button", { name: "Uzupełnij" }).last().click();
  const drawer = page.getByRole("dialog", { name: "Uzupełnij dane" });
  await drawer.getByText("Szerokość drzwi", { exact: true }).click();

  // WHEN the visitor types a width below the range and sends
  const width = drawer.getByRole("textbox", { name: /Jak jest naprawdę/ });
  await width.fill("5");
  await drawer.getByRole("button", { name: "Wyślij" }).click();

  // THEN the error names the allowed range, the field is invalid and keeps focus
  await expect(drawer).toContainText("Podaj liczbę od 10 do 300 cm.");
  await expect(width).toHaveAttribute("aria-invalid", "true");
  await expect(width).toBeFocused();
  await expectAccessible();
  await evidence("place-report-validation");

  // WHEN the value is corrected
  await width.fill("90");
  await page.keyboard.press("Enter");

  // THEN the report is listed under the door width, while the fact still says "Brak danych"
  await expect(drawer).toBeHidden();
  const door = page.getByRole("button", { name: /Szerokość drzwi/ });
  await expect(door).toContainText("Brak danych");
  await expect(page.locator("li").filter({ has: door })).toContainText("Twoje zgłoszenie:90 cm");
});

test("Cofnij withdraws the report before it is sent", async ({ page }) => {
  // GIVEN a report just submitted for the ramp of the outdated demo place
  await page.goto("/miejsca/teatr-slowackiego");
  const ramp = page.locator("li").filter({ has: page.getByRole("button", { name: /Podjazd/ }) });
  await ramp.getByRole("button", { name: "To się nie zgadza" }).click();
  await page.getByText("Nie ma podjazdu").click();
  await page.getByRole("button", { name: "Wyślij" }).click();
  await expect(ramp).toContainText("Twoje zgłoszenie:Nie ma");

  // WHEN the visitor presses "Cofnij" in the toast
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Cofnij" }).click();

  // THEN the report is gone and the withdrawal is announced
  await expect(ramp).not.toContainText("Twoje zgłoszenie");
  await expect(page.getByRole("status").filter({ hasText: "Zgłoszenie cofnięte." })).toBeAttached();
});

test("Cofnij after the report has left says it was already sent", async ({ page }) => {
  // GIVEN a report sent early because the visitor left the card before the undo window ended
  await page.goto("/miejsca/teatr-slowackiego");
  const ramp = page.locator("li").filter({ has: page.getByRole("button", { name: /Podjazd/ }) });
  await ramp.getByRole("button", { name: "To się nie zgadza" }).click();
  await page.getByText("Nie ma podjazdu").click();
  await page.getByRole("button", { name: "Wyślij" }).click();
  await page.getByRole("link", { name: /strona główna/ }).first().click();
  await expect(page).not.toHaveURL(/teatr-slowackiego/);

  // WHEN the visitor presses "Cofnij" in the still visible toast
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Cofnij" }).click();

  // THEN they are told the report can no longer be withdrawn
  await expect(page.getByRole("status").filter({ hasText: "Zgłoszenie zostało już wysłane" })).toBeAttached();
});

test("Potwierdzam, byłem tu records a confirmation beside the fact", async ({ page, expectAccessible }) => {
  // GIVEN the step-free entrance of the conflicting demo place
  await page.goto("/miejsca/palac-krzysztofory");
  const steps = page.getByRole("button", { name: /Wejście — stopnie/ });
  const row = page.locator("li").filter({ has: steps });

  // WHEN the visitor confirms it from the keyboard
  await row.getByRole("button", { name: "Potwierdzam, byłem tu" }).focus();
  await page.keyboard.press("Enter");

  // THEN the thanks are shown and announced, the confirmation is listed and can't be sent twice
  await expect(page.locator("[data-sonner-toast]").getByText("Dzięki! Potwierdzenie zapisane.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Dzięki! Potwierdzenie zapisane." })).toBeAttached();
  await expect(row).toContainText("Twoje potwierdzenie:Bez stopni");
  await expect(row.getByRole("button", { name: "Potwierdzam, byłem tu" })).toHaveCount(0);
  // AND focus stays in the row instead of falling back to the page
  await expect(row.getByRole("button", { name: "To się nie zgadza" })).toBeFocused();
  // AND the OSM object can be edited at the source
  await expect(page.getByRole("link", { name: /Edytuj w OpenStreetMap/ })).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/edit?node=123456",
  );
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 8_000 });
  await expectAccessible();
});
