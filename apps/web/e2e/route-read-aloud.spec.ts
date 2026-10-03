import { expect, test } from "./fixtures";

// The route is the recorded Dworzec Główny → Rynek answer (see route.spec.ts). speechSynthesis is replaced by a
// recorder: headless Chromium has no voices, and the test must hear what would be said.

// POST /routes allows 30 requests a minute per client; its own client key keeps this file from using up route.spec's share.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/routes", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-vercel-forwarded-for": "e2e-route-read-aloud" } }),
  );
});

type Spoken = { text: string; lang: string };

test("Czytaj na głos reads the steps in Polish, pauses, resumes and stops from the keyboard", async ({ page, expectAccessible, evidence }) => {
  // GIVEN a browser whose speech synthesis records what it is asked to say
  await page.addInitScript(() => {
    type Utterance = { text: string; lang: string; onstart?: () => void; onend?: () => void; onerror?: () => void };
    const log: { text: string; lang: string }[] = [];
    let queue: Utterance[] = [];
    Object.defineProperties(window, {
      __spoken: { value: log },
      SpeechSynthesisUtterance: {
        value: class {
          lang = "";
          voice = null;
          constructor(readonly text: string) {}
        },
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak(u: Utterance) {
          log.push({ text: u.text, lang: u.lang });
          queue.push(u);
          if (queue.length === 1) u.onstart?.();
        },
        cancel() {
          const dropped = queue;
          queue = [];
          for (const u of dropped) u.onerror?.();
        },
        getVoices: () => [],
      },
    });
  });
  await page.goto("/trasa?z=station");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken: Spoken[] }).__spoken);

  // WHEN a keyboard user starts reading
  const read = page.getByRole("button", { name: "Czytaj na głos" });
  await read.focus();
  await page.keyboard.press("Enter");

  // THEN every step is queued in Polish, with the step, its state and surface, and missing data said as such
  const pause = page.getByRole("button", { name: "Pauza" });
  await expect(pause).toBeFocused();
  const texts = await spoken();
  expect(texts).toHaveLength(33);
  expect(texts.every((t) => t.lang === "pl-PL")).toBe(true);
  expect(texts[0].text).toMatch(/^Krok 1 z 33\. Kieruj się na południe, \d+ metry\. Spełnia: płyty chodnikowe\. Nawierzchnia: płyty chodnikowe\.$/);
  expect(texts[1].text).toContain("Częściowo nie wiemy: brak danych o nawierzchni na części odcinka.");
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "route-read-aloud.aria.yml" });
  await expectAccessible();
  await evidence("route-read-aloud");

  // WHEN they pause and resume
  await page.keyboard.press("Enter");
  const resume = page.getByRole("button", { name: "Wznów czytanie" });
  await expect(resume).toBeFocused();
  await page.keyboard.press("Enter");

  // THEN reading starts again at the step it was on
  await expect(pause).toBeFocused();
  expect((await spoken()).slice(33)[0].text).toMatch(/^Krok 1 z 33\./);

  // WHEN they tab to "Zatrzymaj czytanie" and press it
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Zatrzymaj czytanie" })).toBeFocused();
  await page.keyboard.press("Enter");

  // THEN reading stops and focus returns to the read-aloud button
  await expect(read).toBeFocused();
  await expect(page.getByRole("button", { name: "Zatrzymaj czytanie" })).toHaveCount(0);
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
