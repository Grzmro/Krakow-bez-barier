import { expect, test } from "./fixtures";

// Reports and confirmations go to the in-browser mock API (`lib/mocks/mock-contributions.ts`), which keeps one
// pending contribution per device and feature like the real one.

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
  await expect(page.locator("[data-sonner-toast]").getByText("Czeka na weryfikację.")).toBeVisible();
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
  // GIVEN the incomplete demo place, filling in the door width from the "Brakuje danych?" box
  await page.goto("/miejsca/kawiarnia-przyklad");
  await page.getByRole("button", { name: "Uzupełnij" }).last().click();
  const drawer = page.getByRole("dialog", { name: "Uzupełnij dane" });
  await drawer.getByText("Szerokość drzwi", { exact: true }).click();

  // WHEN the visitor types a width below the range and sends
  const width = drawer.getByRole("spinbutton", { name: /Jak jest naprawdę/ });
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

test("opening the sheet on a number attribute doesn't focus a text field, so no keyboard pops up", async ({ page }) => {
  // GIVEN the incomplete demo place, whose door width is unknown
  await page.goto("/miejsca/kawiarnia-przyklad");
  const door = page.locator("li").filter({ has: page.getByRole("button", { name: /Szerokość drzwi/ }) });

  // WHEN the visitor taps "Uzupełnij" on the door width (a number)
  await door.getByRole("button", { name: "Uzupełnij" }).click();
  const drawer = page.getByRole("dialog", { name: "Uzupełnij dane" });
  await expect(drawer.getByRole("spinbutton", { name: /Jak jest naprawdę/ })).toBeVisible();

  // THEN focus is on the sheet's title, not on a field that would open the keyboard
  await expect(drawer.getByRole("heading", { name: "Uzupełnij dane" })).toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.matches("input:not([type=radio]), textarea, select"))).toBe(false);
});

test("swiping the attribute chips scrolls only the chip row, not the sheet or the page", async ({ page }) => {
  // GIVEN the "Uzupełnij dane" sheet of the incomplete demo place, opened from a scrolled card
  await page.goto("/miejsca/kawiarnia-przyklad");
  const fill = page.getByRole("button", { name: "Uzupełnij" }).last();
  await fill.scrollIntoViewIfNeeded();
  const pageScroll = await page.evaluate(() => window.scrollY);
  await fill.click();
  const drawer = page.getByRole("dialog", { name: "Uzupełnij dane" });
  const chips = drawer.getByRole("group", { name: "Która cecha?" }).locator("[data-vaul-no-drag]");
  const form = drawer.locator("form");
  await expect(chips).toBeVisible();
  await drawer.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  // AND the sheet is only as wide as the screen: the chips overflow their row, not the form
  expect(await form.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
  expect(await chips.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const title = drawer.getByRole("heading", { name: "Uzupełnij dane" });
  const titleX = (await title.boundingBox())!.x;
  const startScroll = await chips.evaluate((el) => el.scrollLeft);

  // WHEN the visitor swipes the chips to the left with a finger, drifting down a little
  const box = (await chips.boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  const x = box.x + box.width - 40;
  const y = box.y + box.height / 2;
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 15; step++) {
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - step * 15, y: y + step }] });
  }
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  // THEN only the chip row moved: the sheet's content, the sheet and the page behind stay put
  await expect.poll(() => chips.evaluate((el) => el.scrollLeft)).toBeGreaterThan(startScroll);
  expect(await form.evaluate((el) => el.scrollLeft)).toBe(0);
  expect((await title.boundingBox())!.x).toBe(titleX);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
  await expect(drawer).toBeVisible();
});

test("the sheet keeps its size when a text field is focused and the page is pinch-zoomed", async ({ page, evidence }) => {
  // GIVEN the "Uzupełnij dane" sheet of the incomplete demo place, on the door width (a number field)
  await page.goto("/miejsca/kawiarnia-przyklad");
  await page.getByRole("button", { name: "Uzupełnij" }).last().click();
  const drawer = page.getByRole("dialog", { name: "Uzupełnij dane" });
  await drawer.getByText("Szerokość drzwi", { exact: true }).click();
  await drawer.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

  // THEN every text field is at least 16 px, so iOS doesn't zoom in when one is tapped
  const fontSizes = await drawer.evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>("textarea, select, input:not([type=radio]):not([type=checkbox])")].map(
      (field) => parseFloat(getComputedStyle(field).fontSize),
    ),
  );
  expect(fontSizes.length).toBeGreaterThan(0);
  for (const size of fontSizes) expect(size).toBeGreaterThanOrEqual(16);

  // WHEN the visitor taps the comment field
  await drawer.getByRole("textbox", { name: "Komentarz (opcjonalnie)" }).click();

  // THEN the page isn't zoomed and the sheet fits the screen width
  const sheet = () =>
    drawer.evaluate((el) => {
      const { left, right, top, bottom } = el.getBoundingClientRect();
      return { left, right, top, bottom, scale: window.visualViewport!.scale, width: window.innerWidth };
    });
  const opened = await sheet();
  // Chromium never zooms on focus; the font sizes above are what guards iOS.
  expect(opened.scale).toBe(1);
  expect(opened.left).toBeGreaterThanOrEqual(0);
  expect(opened.right).toBeLessThanOrEqual(opened.width);
  expect(await drawer.locator("form").evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);

  // WHEN the visitor pinch-zooms to 2x with the field still focused, then back
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  await page.waitForFunction(() => window.visualViewport!.scale === 2);
  // Two frames: the visualViewport resize listeners have run.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const zoomed = await sheet();
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  await page.waitForFunction(() => window.visualViewport!.scale === 1);

  // THEN the sheet is not taken for a keyboard: same place and size while zoomed and after
  expect({ ...zoomed, scale: 1 }).toEqual(opened);
  expect(await sheet()).toEqual(opened);
  await evidence("place-report-focused-comment");
});

test("a second report of the same feature replaces the first; Wycofaj withdraws it", async ({ page, expectAccessible, evidence }) => {
  // GIVEN a sent report that the ramp of the outdated demo place is missing
  await page.goto("/miejsca/teatr-slowackiego");
  const ramp = page.locator("li").filter({ has: page.getByRole("button", { name: /Podjazd/ }) });
  await ramp.getByRole("button", { name: "To się nie zgadza" }).click();
  await page.getByText("Nie ma podjazdu").click();
  await page.getByRole("button", { name: "Wyślij" }).click();
  await expect(ramp).not.toContainText("wysyłanie", { timeout: 8_000 });

  // THEN the row says the report was sent and offers to change or withdraw it instead of sending another
  await expect(ramp).toContainText("Wysłano zgłoszenie");
  await expect(ramp.getByRole("button", { name: "To się nie zgadza" })).toHaveCount(0);

  // WHEN the visitor changes it to the other value
  await ramp.getByRole("button", { name: "Zmień", exact: true }).click();
  await page.getByRole("dialog").getByText("Jest podjazd", { exact: true }).click();
  await page.getByRole("button", { name: "Wyślij" }).click();
  await expect(ramp).not.toContainText("wysyłanie", { timeout: 8_000 });

  // THEN there is still one own tile, with the new value
  await expect(ramp.getByText("Twoje zgłoszenie:")).toHaveCount(1);
  await expect(ramp).toContainText("Twoje zgłoszenie:Jest");
  await expect(page.getByRole("status").filter({ hasText: "Zgłoszenie zmienione." })).toBeAttached();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 8_000 });
  // axe counts a button half under the sticky header as too small a target; check the card from its top.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectAccessible();
  await ramp.scrollIntoViewIfNeeded();
  await evidence("place-report-changed");

  // WHEN the visitor withdraws it from the keyboard
  await ramp.getByRole("button", { name: "Wycofaj", exact: true }).focus();
  await page.keyboard.press("Enter");

  // THEN the tile is gone, the row offers "To się nie zgadza" again with focus on it
  await expect(ramp).not.toContainText("Twoje zgłoszenie");
  await expect(page.getByRole("status").filter({ hasText: "Wycofano." })).toBeAttached();
  await expect(ramp.getByRole("button", { name: "To się nie zgadza" })).toBeFocused();
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

test("Nadal aktualne records a confirmation beside the fact", async ({ page, expectAccessible }) => {
  // GIVEN the step-free entrance of the conflicting demo place
  await page.goto("/miejsca/palac-krzysztofory");
  const steps = page.getByRole("button", { name: /Wejście — stopnie/ });
  const row = page.locator("li").filter({ has: steps });

  // WHEN the visitor confirms it from the keyboard
  await row.getByRole("button", { name: "Nadal aktualne" }).focus();
  await page.keyboard.press("Enter");

  // THEN the thanks are shown and announced, the confirmation is listed and can't be sent twice
  await expect(page.locator("[data-sonner-toast]").getByText("Potwierdzenie zapisane.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Potwierdzenie zapisane." })).toBeAttached();
  await expect(row).toContainText("Twoje potwierdzenie:Bez stopni");
  await expect(row).toContainText("Potwierdzono");
  await expect(row.getByRole("button", { name: "Nadal aktualne" })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "To się nie zgadza" })).toHaveCount(0);
  // AND focus stays in the row, on "Zmień", instead of falling back to the page
  await expect(row.getByRole("button", { name: "Zmień", exact: true })).toBeFocused();
  // AND the OSM object can be edited at the source
  await expect(page.getByRole("link", { name: /Edytuj w OpenStreetMap/ })).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/edit?node=123456",
  );
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 8_000 });
  await expectAccessible();
});
