import { expect, test } from "./fixtures";
import { fakeSpeech, spoken } from "./speech";

// "Czytaj na głos" in the route preview, on the recorded Dworzec Główny → Rynek answer (see route.spec.ts): one step at a
// time, the whole route only when asked. speechSynthesis is a recorder (./speech).

// POST /routes allows 30 requests a minute per client; its own client key keeps this file from using up route.spec's share.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/routes", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-vercel-forwarded-for": "e2e-route-read-aloud" } }),
  );
});

test("Czytaj na głos reads one step at a time and highlights it, from the keyboard", async ({ page, expectAccessible, evidence }) => {
  // GIVEN a browser whose speech synthesis records what it is asked to say
  await fakeSpeech(page);
  await page.goto("/trasa?z=station");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
  const steps = page.getByRole("list", { name: "Odcinki trasy, tekstowa wersja mapy" }).getByRole("listitem");

  // WHEN a keyboard user starts reading
  await page.getByRole("button", { name: "Czytaj na głos" }).focus();
  await page.keyboard.press("Enter");

  // THEN only step 1 is said, in Polish with units in words, and it is highlighted; focus moves to "Następny krok"
  await expect(page.getByRole("button", { name: "Następny krok" })).toBeFocused();
  let said = await spoken(page);
  expect(said).toHaveLength(1);
  expect(said[0].lang).toBe("pl-PL");
  expect(said[0].text).toMatch(/^Krok 1 z 33\. Kieruj się na południe, \d+ metry\. Spełnia: płyty chodnikowe\. Nawierzchnia: płyty chodnikowe\.$/);
  await expect(steps.nth(0)).toHaveAttribute("aria-current", "step");
  await expect(page.getByText("Czytany krok: 1 z 33")).toBeVisible();

  // WHEN they press "Następny krok"
  await page.keyboard.press("Enter");

  // THEN step 2 alone is said and highlighted
  said = await spoken(page);
  expect(said).toHaveLength(2);
  expect(said[1].text).toMatch(/^Krok 2 z 33\. Skręć w prawo, \d+ metrów\. Częściowo nie wiemy: brak danych o nawierzchni na części odcinka\./);
  await expect(steps.nth(1)).toHaveAttribute("aria-current", "step");
  await expect(steps.nth(0)).not.toHaveAttribute("aria-current");
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "route-read-aloud.aria.yml" });
  await expectAccessible();
  await evidence("route-read-aloud");

  // WHEN they repeat it and go back
  await page.getByRole("button", { name: "Powtórz krok" }).click();
  await page.getByRole("button", { name: "Poprzedni krok" }).click();

  // THEN step 2 is said again, then step 1
  said = await spoken(page);
  expect(said.slice(2).map((s) => s.text.slice(0, 12))).toEqual(["Krok 2 z 33.", "Krok 1 z 33."]);
  await expect(steps.nth(0)).toHaveAttribute("aria-current", "step");

  // WHEN they finish reading
  await page.getByRole("button", { name: "Zakończ czytanie" }).click();

  // THEN nothing is highlighted and focus is back on "Czytaj na głos"
  await expect(page.getByRole("button", { name: "Czytaj na głos" })).toBeFocused();
  await expect(steps.and(page.locator("[aria-current]"))).toHaveCount(0);
});

test("the whole route is read only when asked, and can be stopped", async ({ page }) => {
  // GIVEN reading started on step 1
  await fakeSpeech(page);
  await page.goto("/trasa?z=station");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
  await page.getByRole("button", { name: "Czytaj na głos" }).click();
  expect(await spoken(page)).toHaveLength(1);

  // WHEN they choose "Przeczytaj całą trasę"
  await page.getByRole("button", { name: "Przeczytaj całą trasę" }).click();

  // THEN every step is queued, one utterance each, from the step they were on
  const said = (await spoken(page)).slice(1);
  expect(said).toHaveLength(33);
  expect(said[0].text).toMatch(/^Krok 1 z 33\./);
  expect(said[32].text).toMatch(/^Krok 33 z 33\./);

  // WHEN they stop it
  const stop = page.getByRole("button", { name: "Zatrzymaj czytanie" });
  await expect(stop).toBeFocused();
  await page.keyboard.press("Enter");

  // THEN reading stops; the same button offers the whole route again
  await expect(page.getByRole("button", { name: "Przeczytaj całą trasę" })).toBeFocused();
  expect(await spoken(page)).toHaveLength(34);
});

test("without a Polish voice it says so instead of reading Polish in another voice", async ({ page }) => {
  // GIVEN a device with English voices only
  await fakeSpeech(page, [{ lang: "en-US" }]);
  await page.goto("/trasa?z=station");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);

  // WHEN they press "Czytaj na głos"
  await page.getByRole("button", { name: "Czytaj na głos" }).click();

  // THEN nothing is said and the screen explains why
  await expect(page.locator("main").getByText("To urządzenie nie ma polskiego głosu")).toBeVisible();
  expect(await spoken(page)).toHaveLength(0);
});

test("without speech synthesis there is no read-aloud button", async ({ page }) => {
  // GIVEN a browser without speech synthesis
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { value: undefined });
  });

  // WHEN the route screen opens
  await page.goto("/trasa?z=station");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);

  // THEN the step list is there and the button is not
  await expect(page.getByRole("list", { name: "Odcinki trasy, tekstowa wersja mapy" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Czytaj na głos" })).toHaveCount(0);
});
