import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { gotoAllPlaces } from "./map";

// A stand-in for the browser's SpeechRecognition: the test drives its events, so no microphone or network is used.
async function fakeSpeech(page: Page) {
  await page.addInitScript(() => {
    type Handler = ((event?: unknown) => void) | null;
    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = true;
      maxAlternatives = 5;
      onstart: Handler = null;
      onspeechend: Handler = null;
      onresult: Handler = null;
      onerror: Handler = null;
      onend: Handler = null;
      start() {
        (window as unknown as { __speech: FakeRecognition }).__speech = this;
        setTimeout(() => this.onstart?.(), 0);
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onerror?.({ error: "aborted" });
        this.onend?.();
      }
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
  });
}

type Fake = {
  lang: string;
  onresult: (event: unknown) => void;
  onspeechend: () => void;
  onerror: (event: unknown) => void;
  onend: () => void;
};

const speak = (page: Page, text: string, final: boolean) =>
  page.evaluate(
    ([transcript, isFinal]) => {
      const fake = (window as unknown as { __speech: Fake }).__speech;
      fake.onresult({ resultIndex: 0, results: [Object.assign([{ transcript }], { isFinal })] });
    },
    [text, final] as const,
  );

const fakeCall = (page: Page, call: "speechEnd" | "end" | "blocked") =>
  page.evaluate((what) => {
    const fake = (window as unknown as { __speech: Fake }).__speech;
    if (what === "speechEnd") fake.onspeechend();
    else if (what === "end") fake.onend();
    else {
      fake.onerror({ error: "not-allowed" });
      fake.onend();
    }
  }, call);

test("dictation fills the search field in Polish, which the visitor can still edit", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN a browser with speech recognition
  await fakeSpeech(page);
  await gotoAllPlaces(page);
  const list = page.getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("10 miejsc");
  // The list's own (debounced) announcement would otherwise replace "Słucham…" in the one live region on a slow run.
  await expect(page.getByRole("status").filter({ hasText: "Znaleziono 10 miejsc" })).toBeAttached();
  const mic = page.getByRole("button", { name: "Wpisz głosem" });
  const field = page.getByRole("combobox", { name: "Wyszukaj miejsce" });

  // WHEN the visitor presses the microphone with the keyboard
  await mic.focus();
  await page.keyboard.press("Enter");

  // THEN the browser's speech processing is explained once, recording is shown and announced in pl-PL
  await expect(page.getByText(/Mowę rozpoznaje Twoja przeglądarka/)).toBeVisible();
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await expect(field).toHaveAttribute("placeholder", "Słucham… mów teraz");
  await expect(page.getByRole("status").filter({ hasText: "Słucham… mów teraz" })).toBeAttached();
  expect(await page.evaluate(() => (window as unknown as { __speech: Fake }).__speech.lang)).toBe("pl-PL");
  await expect(page.getByRole("search")).toMatchAriaSnapshot({ name: "voice-search.aria.yml" });
  await expectAccessible();
  await evidence("voice-search-listening");

  // WHEN they say "Sukiennice" and pause
  await speak(page, "Sukien", false);
  await expect(field).toHaveValue("Sukien");
  await fakeCall(page, "speechEnd");
  await speak(page, "Sukiennice", true);
  await fakeCall(page, "end");

  // THEN the text is in the field, the list is filtered, and recording is off
  await expect(field).toHaveValue("Sukiennice");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("1 miejsce");
  await expect(mic).toHaveAttribute("aria-pressed", "false");
  await evidence("voice-search-result");

  // AND they can correct it by typing
  await field.fill("Sukiennice Muzeum");
  await expect(field).toHaveValue("Sukiennice Muzeum");
});

test("dictation uses English when the app is in English", async ({ page }) => {
  // GIVEN English was chosen before
  await fakeSpeech(page);
  await page.goto("/");
  await page.evaluate(() => (document.cookie = "kbb-lang=en; path=/"));
  await page.goto("/");

  // WHEN the visitor dictates
  await page.getByRole("button", { name: "Type by voice" }).click();
  await expect(page.getByText(/Your browser recognises the speech/)).toBeVisible();
  await speak(page, "Wawel Castle", true);
  await fakeCall(page, "end");

  // THEN recognition ran in en-GB and the text landed in the field
  expect(await page.evaluate(() => (window as unknown as { __speech: Fake }).__speech.lang)).toBe("en-GB");
  await expect(page.getByRole("combobox", { name: "Search for a place" })).toHaveValue("Wawel Castle");
});

test("a blocked microphone gets a clear message", async ({ page }) => {
  // GIVEN speech recognition the user hasn't allowed the microphone for
  await fakeSpeech(page);
  await page.goto("/");
  const mic = page.getByRole("button", { name: "Wpisz głosem" });

  // WHEN they press the microphone and the browser refuses
  await mic.click();
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await fakeCall(page, "blocked");

  // THEN they're told how to fix it and recording is off
  const message = "Brak dostępu do mikrofonu. Zezwól na mikrofon w ustawieniach przeglądarki i spróbuj ponownie.";
  await expect(page.getByText(message).first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: message })).toBeAttached();
  await expect(mic).toHaveAttribute("aria-pressed", "false");
});

test("the privacy page explains that the browser processes speech", async ({ page }) => {
  // WHEN the privacy page is opened
  await page.goto("/prywatnosc");

  // THEN it has a section about voice search, with the browser's speech service one tap away under "Szczegóły"
  await expect(page.getByRole("heading", { level: 2, name: "Wyszukiwanie głosem" })).toBeVisible();
  await expect(page.getByText("Mowę rozpoznaje Twoja przeglądarka, nie nasz serwer.")).toBeVisible();
  const voice = page.locator("section").filter({ has: page.getByRole("heading", { name: "Wyszukiwanie głosem" }) });
  await voice.getByText("Szczegóły").click();
  await expect(page.getByText(/może wysłać nagranie do usługi rozpoznawania mowy/)).toBeVisible();
});

test("without speech recognition there is no microphone button", async ({ page }) => {
  // GIVEN a browser without the Web Speech API (e.g. Firefox)
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "SpeechRecognition");
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
  });

  // WHEN the home screen opens
  await page.goto("/");
  await expect(page.getByRole("combobox", { name: "Wyszukaj miejsce" })).toBeVisible();

  // THEN no microphone is offered
  await expect(page.getByRole("button", { name: "Wpisz głosem" })).toHaveCount(0);
});

test.describe("voice commands with location access granted", () => {
  test.use({ geolocation: { latitude: 50.0541, longitude: 19.9354, accuracy: 20 }, permissions: ["geolocation"] });

  test("'najbliższa toaleta' picks the category and turns on 'W mojej okolicy'", async ({ page }) => {
    // GIVEN a browser with speech recognition
    await fakeSpeech(page);
    await page.goto("/");
    const field = page.getByRole("combobox", { name: "Wyszukaj miejsce" });

    // WHEN the visitor says "najbliższa toaleta"
    await page.getByRole("button", { name: "Wpisz głosem" }).click();
    await speak(page, "najbliższa toaleta", true);
    await fakeCall(page, "end");

    // THEN the category is chosen, the list is sorted from the user, and the command is not left in the field
    await expect(page.getByRole("button", { name: "Toalety" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "W mojej okolicy" })).toHaveAttribute("aria-pressed", "true");
    await expect(field).toHaveValue("");
  });
});

test("an unclear 'nearest' command suggests example commands", async ({ page }) => {
  // GIVEN a browser with speech recognition
  await fakeSpeech(page);
  await page.goto("/");

  // WHEN the visitor asks for the nearest something unknown
  await page.getByRole("button", { name: "Wpisz głosem" }).click();
  await speak(page, "najbliższy smok", true);
  await fakeCall(page, "end");

  // THEN they get examples instead of an empty text search
  await expect(page.getByRole("note").filter({ hasText: "Nie rozumiem tego polecenia." })).toContainText("najbliższa toaleta");
});
