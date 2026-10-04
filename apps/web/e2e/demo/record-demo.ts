import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { components, PlaceList, PlaceSummary } from "@krakow-bez-barier/contracts";
import { expect, test, type APIRequestContext, type Frame, type Locator, type Page } from "@playwright/test";
import { pl } from "../../src/i18n/pl";
import { settleMotion, WCAG_TAGS } from "../fixtures";
import { fakeSpeech } from "../speech";

// Records the submission video from docs/demo-script.md ("Wideo do zgłoszenia"): the jury's live-demo scenes for a
// wheelchair user, 1920×1080, the app on a desktop screen with a Polish caption bar under it (the subtitles are part of
// the picture, so any player shows them) plus an .srt file and a subtitle track in the MP4. No voice-over.
//
// Two servers (playwright.demo.config.ts): real data for everything that only reads, and the example API for the
// scenes that write — a report, the demo moderator's approval, the source-outage switch — so a recording never leaves
// a report or a decision behind in a shared database. Those scenes show the PRZYKŁAD label and a caption-bar badge.

/** Real places, looked up in the API by name — never by id. */
const PLACES = {
  /** BIP MK accessibility page: entrance, lift and toilet with a quote and a date; the door width is missing. */
  bip: "Hangar Czyżyny Oddział Muzeum Inżynierii Miejskiej",
};
const SEARCH = "Hangar";
const ROUTE_START = "Dworzec Główny";
/** openapi.yaml example places on the sample server. */
const SAMPLE = {
  incomplete: { id: "kawiarnia-przyklad", name: "Kawiarnia Przykład" },
  conflict: { id: "palac-krzysztofory", name: "Pałac Krzysztofory" },
  outage: { id: "hotel-przyklad", name: "Hotel Przykład" },
};
const SETUP_HINT =
  "Load the data first: `npm run db:setup` and the ingest of osm and bip-mk; the route scene needs ORS_API_KEY on the server (docs/demo-script.md).";

const MAX_SECONDS = 180;
// DEMO_PACE=0.2 shortens every pause, for checking the walkthrough without waiting 3 minutes.
const PACE = Number(process.env.DEMO_PACE) > 0 ? Number(process.env.DEMO_PACE) : 1;
const OUT_DIR = process.env.DEMO_OUT_DIR ? path.resolve(process.env.DEMO_OUT_DIR) : path.join(__dirname, "..", "..", "demo-output");
const VIDEO = { width: 1920, height: 1080 };
const BAR_HEIGHT = 150;
const PHONE = { width: 390, height: 844 };

// Recording-only page around the app; never served by the app itself.
const STAGE_HTML = `<!doctype html><html lang="pl"><meta charset="utf-8"><title>Kraków bez barier — demo</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; width: ${VIDEO.width}px; height: ${VIDEO.height}px; overflow: hidden; background: #120d26;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #fff; }
  #screen { position: absolute; inset: 0 0 ${BAR_HEIGHT}px 0; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 30% 20%, #3b2a7a, #120d26 70%); }
  #device { width: 100%; height: 100%; }
  #app { display: block; width: 100%; height: 100%; border: 0; background: #fff; }
  body.phone #device { width: ${PHONE.width + 24}px; height: ${PHONE.height + 24}px; padding: 12px; border-radius: 52px;
    background: #0b0b10; box-shadow: 0 30px 80px rgba(0,0,0,.55), inset 0 0 0 2px #2a2a35; }
  body.phone #app { border-radius: 40px; }
  #bar { position: absolute; left: 0; right: 0; bottom: 0; height: ${BAR_HEIGHT}px; display: flex; align-items: center;
    gap: 40px; padding: 0 56px; background: #120d26; border-top: 4px solid #7c3aed; }
  #scene { flex: 0 0 300px; font-size: 22px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #c4b5fd; }
  #text { flex: 1; font-size: 33px; font-weight: 600; line-height: 1.28; }
  #badge { display: none; flex: 0 0 auto; padding: 8px 14px; border: 2px solid #fcd34d; border-radius: 10px;
    color: #fcd34d; font-size: 20px; font-weight: 800; letter-spacing: .08em; text-align: center; line-height: 1.25; }
  body.sample #badge { display: block; }
</style>
<div id="screen"><div id="device"><iframe id="app" name="app" title="Aplikacja Kraków bez barier"></iframe></div></div>
<div id="bar"><div id="scene"></div><div id="text"></div><div id="badge">PRZYKŁAD<br><small>dane przykładowe</small></div></div>
</html>`;

type Cue = { at: number; scene: string; text: string };
/** One axe run on the app frame; `passedNodes` shows it really read the app (an empty frame passes with ~0). */
type AxeResult = { screen: string; url: string; passedNodes: number; violations: string[] };

let startedAt = 0;
const elapsed = () => (Date.now() - startedAt) / 1000;
const pause = (page: Page, seconds: number) => page.waitForTimeout(seconds * 1000 * PACE);
/** How long a caption stays up at least: a second to notice it, then about 20 characters a second. */
const readingSeconds = (text: string) => (text ? 1 + text.length / 20 : 0);
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** Fails with what to do when the app can't read its database, instead of recording empty screens. */
async function requireDatabase(request: APIRequestContext) {
  const response = await request.get("/api/v1/health");
  const health = (await response.json().catch(() => null)) as components["schemas"]["Health"] | null;
  const database = health?.checks?.database;
  if (database?.status !== "up") {
    throw new Error(
      `The demo records real data, but the app's database is ${database?.status ?? `unreachable (health ${response.status()})`}` +
        `${database?.detail ? ` — ${database.detail.replace(/\.$/, "")}` : ""}. ${SETUP_HINT}`,
    );
  }
}

async function placeNamed(request: APIRequestContext, query: string, name: string): Promise<PlaceSummary> {
  const response = await request.get(`/api/v1/places?q=${encodeURIComponent(query)}&limit=50`);
  expect(response.ok(), `GET /api/v1/places?q=${query} answered ${response.status()}`).toBe(true);
  const place = ((await response.json()) as PlaceList).items.find((p) => p.name === name && !p.isSample);
  if (!place) throw new Error(`The demo place "${name}" is not in the database. ${SETUP_HINT}`);
  return place;
}

/** The app is on real data: no PRZYKŁAD tag anywhere on the screen. */
async function expectNoSampleLabel(app: Frame) {
  await expect(app.getByText(pl.common.sample.tag, { exact: true })).toHaveCount(0);
}

/** The stage's app frame, found again after the stage re-renders it. */
const appFrame = (page: Page) => page.frame({ name: "app" })!;

/** Marks where the "finger" taps — the recording has no mouse cursor — then clicks (or presses Enter). */
async function tap(page: Page, target: Locator, how: "click" | "enter" = "click") {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box) {
    await page.evaluate(
      ({ x, y }) => {
        const dot = document.createElement("div");
        dot.style.cssText =
          `position:fixed;left:${x - 24}px;top:${y - 24}px;width:48px;height:48px;border-radius:50%;` +
          "z-index:10;pointer-events:none;background:rgba(124,58,237,.35);border:3px solid #7c3aed;" +
          "transition:opacity .6s,transform .6s";
        document.body.appendChild(dot);
        setTimeout(() => {
          dot.style.opacity = "0";
          dot.style.transform = "scale(1.6)";
        }, 500);
        setTimeout(() => dot.remove(), 1200);
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
  }
  await pause(page, 0.6);
  if (how === "enter") await target.press("Enter");
  else await target.click();
}

async function typeSlowly(page: Page, target: Locator, text: string) {
  await tap(page, target);
  await target.pressSequentially(text, { delay: 120 * PACE });
}

test("record the demo video", async ({ browser, baseURL, request }) => {
  const sampleURL = process.env.DEMO_SAMPLE_BASE_URL;
  if (!sampleURL) throw new Error("DEMO_SAMPLE_BASE_URL is not set (playwright.demo.config.ts sets it).");

  // GIVEN the real-data app answers from a database that holds the demo place
  await requireDatabase(request);
  const bip = await placeNamed(request, SEARCH, PLACES.bip);

  const cues: Cue[] = [];
  const axe: AxeResult[] = [];
  let shown = { at: 0, text: "" };

  // The video starts with the context, so caption times and the length check count from here.
  startedAt = Date.now();
  const context = await browser.newContext({
    viewport: VIDEO,
    recordVideo: { dir: test.info().outputPath("video"), size: VIDEO },
  });
  const page = await context.newPage();
  // Headless Chromium has no voices; "Czytaj na głos" gets a silent Polish one (the video has no sound anyway).
  await fakeSpeech(page, [{ lang: "pl-PL" }]);
  // The dev server's Next.js badge is not part of the app.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.appendChild(style);
    });
  });
  const stage = new URL("/__demo-stage", baseURL).toString();
  await page.route(stage, (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: STAGE_HTML }));
  await page.goto(stage);

  const app = () => appFrame(page);
  const open = async (url: string, base = baseURL) => {
    await app().goto(new URL(url, base).toString());
  };
  const caption = async (scene: string, text: string) => {
    const at = elapsed();
    cues.push({ at, scene, text });
    shown = { at, text };
    console.log(`${clock(at)}  ${scene} — ${text}`);
    await page.evaluate(
      ({ scene, text }) => {
        document.getElementById("scene")!.textContent = scene;
        document.getElementById("text")!.textContent = text;
      },
      { scene, text },
    );
  };
  const stageMode = (mode: { sample?: boolean; phone?: boolean }) =>
    page.evaluate(({ sample, phone }) => {
      document.body.classList.toggle("sample", !!sample);
      document.body.classList.toggle("phone", !!phone);
    }, mode);
  /**
   * Holds the shot for `seconds`, and at least until the current caption has been on screen long enough to read; runs
   * axe (WCAG 2.2 A/AA) on the app meanwhile when `screen` is given.
   */
  const hold = async (minimum: number, screen?: string) => {
    const seconds = Math.max(minimum, readingSeconds(shown.text) - (elapsed() - shown.at) / PACE);
    const check = async () => {
      if (!screen) return;
      await settleMotion(app());
      const { violations, passes } = await new AxeBuilder({ page }).include("#app").withTags(WCAG_TAGS).analyze();
      axe.push({
        screen,
        url: app().url(),
        passedNodes: passes.reduce((sum, rule) => sum + rule.nodes.length, 0),
        violations: violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
      });
    };
    await Promise.all([pause(page, seconds), check()]);
  };
  const factRow = (label: string) => app().getByRole("button", { name: new RegExp(`^${label}:`) });

  // 1. Who and what they need (real data)
  await open("/");
  const list = app().getByRole("region", { name: "Lista miejsc" });
  await expect(list.getByRole("heading", { level: 2 }).first()).toBeVisible();
  await expectNoSampleLabel(app());
  await caption("1 · Dla kogo", "Pani Anna jeździ na wózku. Chce wiedzieć, czy wjedzie, zanim wyjdzie z domu. Bez konta.");
  await hold(4.5, "home");
  await caption("1 · Dla kogo", "Wybiera profil „Wózek”: same progi — stopnie, drzwi, winda, toaleta. Profil zostaje w przeglądarce.");
  await tap(page, app().getByRole("radio", { name: "Wózek", exact: true }));
  await expect(app().getByRole("radio", { name: "Wózek", exact: true })).toBeChecked();
  await hold(4);

  // 2. A real place: BIP facts with quote, date and source
  await caption("2 · Miejsce i źródło", `Szuka „${SEARCH}”. Prawdziwe miejsca z OpenStreetMap i deklaracji dostępności w BIP.`);
  const search = app().getByRole("combobox", { name: "Wyszukaj miejsce" });
  await typeSlowly(page, search, SEARCH);
  await search.press("Enter");
  await search.press("Escape");
  const row = list.getByRole("listitem").filter({ has: app().getByRole("link", { name: new RegExp(SEARCH) }) }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText(/Brak danych\s*·\s*drzwi/);
  await hold(3.5, "home-search");
  await caption("2 · Miejsce i źródło", "Werdykt jest słowem, nie kolorem: „Brak danych · drzwi”. Brak danych nigdy nie znaczy „dostępne”.");
  await hold(4.5);
  await tap(page, row.getByRole("link", { name: new RegExp(SEARCH) }));
  await expect(app().getByRole("heading", { level: 1, name: bip.name })).toBeVisible();
  await expectNoSampleLabel(app());
  await expect(app().getByRole("heading", { level: 2, name: "Twój profil: Wózek" })).toBeVisible();
  const matches = app().getByText(/^Pasuje \d+ z \d+ potrzeb profilu$/);
  await expect(matches).toBeVisible();
  const matched = (await matches.textContent())!.replace(/^Pasuje/, "pasuje");
  // What the next caption claims: lift and toilet known, door width unknown, BIP MK the card's only source.
  const lift = factRow(pl.common.attribute.lift);
  await expect(lift).toContainText("Jest");
  await expect(factRow(pl.common.attribute.toilet_accessible)).toContainText("Jest");
  await expect(factRow(pl.common.attribute.door_width_cm)).toContainText(pl.common.status.unknown);
  await expect(app().getByText(/^1 źródło · /)).toBeVisible();
  await expect(app().getByText("BIP Miasta Krakowa: dostępność architektoniczna", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await caption("2 · Miejsce i źródło", `Karta: ${matched}. Winda i toaleta są w deklaracji BIP; szerokości drzwi nie podaje żadne źródło.`);
  await hold(6, "place");
  await tap(page, lift);
  const liftPanel = app().locator(`#${await lift.getAttribute("aria-controls")}`);
  await expect(liftPanel).toContainText("BIP Miasta Krakowa");
  await expect(liftPanel).toContainText("wg źródła");
  await expect(lift).toHaveAccessibleName(new RegExp(pl.common.reliability.unverified));
  await caption("2 · Miejsce i źródło", "Przy każdej cesze: źródło, cytat ze strony BIP, data stanu i link. Jedno źródło — „Niezweryfikowane”.");
  await hold(7.5, "place-fact");

  // 3. Uzupełnij → demo moderator → Zatwierdź (sample data: these steps write)
  await stageMode({ sample: true });
  await open(`/miejsca/${SAMPLE.incomplete.id}`, sampleURL);
  await expect(app().getByRole("heading", { level: 1, name: SAMPLE.incomplete.name })).toBeVisible();
  await expect(app().getByText(pl.common.sample.tag, { exact: true }).first()).toBeVisible();
  await caption("3 · Uzupełnij", "Zapis pokazujemy na danych przykładowych (PRZYKŁAD), żeby nagranie nie zmieniło prawdziwej bazy.");
  await hold(4.5, "place-incomplete");
  await caption("3 · Uzupełnij", "Ktoś zmierzył drzwi: „Uzupełnij” → „Szerokość drzwi” → 90 cm. Bez konta i bez e-maila.");
  await tap(page, app().getByRole("button", { name: "Uzupełnij" }).last());
  const fill = app().getByRole("dialog", { name: "Uzupełnij dane" });
  await expect(fill).toBeVisible();
  await tap(page, fill.getByText(pl.common.attribute.door_width_cm, { exact: true }));
  const width = fill.getByRole("spinbutton", { name: /Jak jest naprawdę/ });
  await typeSlowly(page, width, "90");
  await pause(page, 1);
  await tap(page, fill.getByRole("button", { name: "Wyślij" }), "enter");
  await expect(fill).toBeHidden();
  const door = app().locator("li").filter({ has: factRow(pl.common.attribute.door_width_cm) });
  await expect(door).toContainText("Twoje zgłoszenie:90 cm");
  await caption("3 · Uzupełnij", "Zgłoszenie czeka na moderatora. Do tego czasu nie zmienia danych na karcie.");
  await hold(4.5);

  await open("/moderator", sampleURL);
  await caption("3 · Zatwierdź", "Jury może wejść na konto demonstracyjne moderatora jednym przyciskiem.");
  await tap(page, app().getByRole("button", { name: "Wejdź na konto demonstracyjne (dla jury)" }));
  await expect(app().getByRole("complementary", { name: "Konto demonstracyjne" })).toBeVisible();
  await hold(3.5, "moderator");
  await expect(app().getByRole("main")).toContainText(/Teraz\s*Jest\s*OpenStreetMap[\s\S]*Po zatwierdzeniu\s*Nie ma/);
  await caption(
    "3 · Zatwierdź",
    "Moderator otwiera przykładowe zgłoszenie z kolejki i widzi, co zmieni się na karcie: teraz „Jest” z OpenStreetMap, potem „Nie ma”.",
  );
  await hold(5);
  await tap(page, app().getByRole("button", { name: "Zatwierdź" }));
  const history = app().locator("section").filter({ has: app().getByRole("heading", { name: "Historia zmian" }) });
  await expect(history.getByRole("listitem").first()).toContainText("Konto demonstracyjne ·");
  await history.scrollIntoViewIfNeeded();
  await caption("3 · Zatwierdź", "Decyzja trafia do historii. Konto demo cofa każdą zmianę samo po 30 minutach.");
  await hold(4.5);

  // 4. Conflicting sources (sample data)
  await caption("4 · Sprzeczne", "Dwa źródła się nie zgadzają? Nie wybieramy za użytkownika: „Sprzeczne” i obie wartości z datami.");
  await open(`/miejsca/${SAMPLE.conflict.id}`, sampleURL);
  await expect(app().getByRole("heading", { level: 1, name: SAMPLE.conflict.name })).toBeVisible();
  const toilet = factRow(pl.common.attribute.toilet_accessible);
  await expect(toilet).toContainText("Sprzeczne");
  await tap(page, toilet);
  await hold(6.5, "place-conflict");

  // 5. Source outage via the demo account's switch (sample data)
  await caption("5 · Awaria źródła", "Symulujemy awarię źródła przełącznikiem konta demo. Wyłączy się sama po 15 minutach.");
  await open("/moderator", sampleURL);
  await tap(page, app().getByRole("tab", { name: "Demo źródeł" }));
  const sources = app().getByRole("tabpanel", { name: "Demo źródeł" });
  await tap(page, sources.getByRole("button", { name: "Symuluj awarię" }));
  await expect(sources).toContainText("symulowana awaria");
  await hold(2.5);
  await tap(page, sources.getByRole("link", { name: "Zobacz w „O danych”" }));
  await expect(app().getByRole("heading", { level: 1, name: "O danych" })).toBeVisible();
  await expect(app().getByText(/Odświeżenie nie powiodło się — dane z /).first()).toBeVisible();
  await caption("5 · Awaria źródła", "Nic nie znika: zostaje ostatnia dobra kopia z datą, a aplikacja mówi wprost „Niedostępne”.");
  await hold(5, "about-data-outage");
  await open(`/miejsca/${SAMPLE.outage.id}`, sampleURL);
  await expect(app().getByRole("heading", { level: 1, name: SAMPLE.outage.name })).toBeVisible();
  await expect(app().getByText(/Odświeżenie nie powiodło się/).first()).toBeVisible();
  await caption("5 · Awaria źródła", "Na karcie: „Odświeżenie nie powiodło się”, fakty oznaczone jako możliwie nieaktualne.");
  await hold(4.5);
  await open("/moderator", sampleURL);
  await app().getByRole("tab", { name: "Demo źródeł" }).click();
  await tap(page, sources.getByRole("button", { name: /^Wyłącz symulowaną awarię/ }));
  await expect(sources).toContainText("Żadna symulacja nie trwa");
  await caption("5 · Awaria źródła", "Wyłączamy symulację — źródło znów działa.");
  await hold(2);

  // 6. Route with segments without data, step-by-step guidance and read-aloud (real data)
  await stageMode({});
  await open(`/trasa?do=${encodeURIComponent(bip.id)}`);
  await caption("6 · Trasa", "Trasa z Dworca Głównego do hangaru, z profilem Wózek. Wyznacza ją openrouteservice.");
  const start = app().getByRole("combobox", { name: "Start" });
  await typeSlowly(page, start, "Dworzec");
  await tap(page, app().getByRole("option", { name: ROUTE_START, exact: true }));
  const routeSummary = app().getByText(/^Brak znanych barier|^Nie spełnia|bez danych$/).first();
  await expect(routeSummary, `no route Dworzec Główny → ${bip.name}. ${SETUP_HINT}`).toBeVisible({ timeout: 30_000 });
  await expectNoSampleLabel(app());
  const summary = (await routeSummary.textContent())!.trim();
  await expect(app().getByRole("region", { name: "Odcinki trasy" })).toContainText(/Najkrótsza[\s\S]{0,40}Nie spełnia[\s\S]{0,20}schody/);
  await caption("6 · Trasa", `Odcinek bez danych nigdy nie jest „spełnia”: „${summary}”. Wariant „Najkrótsza” ma schody.`);
  await hold(7, "route");
  const readAloud = app().getByRole("button", { name: "Czytaj na głos" });
  await readAloud.scrollIntoViewIfNeeded();
  await caption("6 · Trasa", "„Krok po kroku” to tekstowa wersja mapy. „Czytaj na głos” czyta po jednym kroku.");
  await tap(page, readAloud);
  await expect(app().getByText(/Czytany krok: 1 z \d+/)).toBeVisible();
  await hold(4);
  await tap(page, app().getByRole("button", { name: "Następny krok" }));
  await hold(2.5);
  await tap(page, app().getByRole("button", { name: "Zakończ czytanie" }));
  await caption("6 · Trasa", "„Ruszamy” prowadzi krok po kroku — także bez zgody na lokalizację, przyciskami.");
  await tap(page, app().getByRole("button", { name: "Ruszamy" }));
  await expect(app().getByRole("heading", { level: 1, name: "Prowadzenie" })).toBeVisible();
  await hold(3.5, "route-guidance");
  await tap(page, app().getByRole("button", { name: "Następny krok" }));
  await hold(2.5);

  // 7. Businesses: widget, event page, API (real data)
  await open(`/dla-firm?miejsce=${encodeURIComponent(bip.id)}`);
  await expect(app().frameLocator("iframe").first().getByRole("heading", { name: bip.name })).toBeVisible();
  await expectNoSampleLabel(app());
  await caption("7 · Dla firm", "Obiekt osadza aktualną kartę na swojej stronie jednym kodem — te same fakty, źródła i daty.");
  await hold(5, "business");
  await app().getByRole("heading", { name: "Strona wydarzenia" }).scrollIntoViewIfNeeded();
  await caption("7 · Dla firm", "Organizator generuje stronę „Dojazd i wejście bez barier”, a systemy biorą dane z API.");
  await hold(3.5);
  await open(`/wydarzenie/${encodeURIComponent(bip.id)}?nazwa=${encodeURIComponent("Piknik lotniczy")}&data=2026-10-10`);
  await expect(app().getByRole("heading", { level: 1, name: "Piknik lotniczy" })).toBeVisible();
  await hold(4, "event");
  await open("/api/docs");
  await caption("7 · Model", "Płacą obiekty i partnerzy — za kartę i weryfikację. Mieszkańcy i turyści korzystają za darmo.");
  await hold(4.5);

  // 8. Phone and closing
  await caption("8 · Telefon", "Na telefonie to samo: aplikacja webowa, PWA i aplikacje na Androida i iOS.");
  await stageMode({ phone: true });
  await open(`/miejsca/${encodeURIComponent(bip.id)}`);
  await expect(app().getByRole("heading", { level: 1, name: bip.name })).toBeVisible();
  await hold(4.5, "place-phone");
  await stageMode({});
  await open("/");
  await expect(list.getByRole("heading", { level: 2 }).first()).toBeVisible();
  await page.locator("#app").focus();
  await page.keyboard.press("Tab");
  await expect(app().getByRole("link", { name: "Przejdź do treści" })).toBeFocused();
  await caption("8 · Zakończenie", "Całość działa z klawiatury, statusy są tekstem, lista to pełna wersja mapy. Prowadzi niezależny operator.");
  await hold(5);
  await caption("Kraków bez barier", "Konkretne fakty, źródło przy każdej informacji, otwarte dane. Dziękujemy!");
  await hold(3.5);

  const seconds = elapsed();
  const video = page.video()!;
  await context.close();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const webm = path.join(OUT_DIR, "kbb-demo.webm");
  await video.saveAs(webm);
  const srt = path.join(OUT_DIR, "kbb-demo.srt");
  fs.writeFileSync(srt, toSrt(cues, seconds));
  fs.writeFileSync(path.join(OUT_DIR, "axe.json"), `${JSON.stringify(axe, null, 2)}\n`);
  console.log(`Demo recorded in ${seconds.toFixed(0)} s → ${webm}, subtitles → ${srt}`);
  saveMp4(webm, srt);

  expect(seconds, `the demo must fit in ${MAX_SECONDS} s`).toBeLessThanOrEqual(MAX_SECONDS);
  expect(
    axe.filter((r) => r.violations.length).map((r) => `${r.screen}: ${r.violations.join("; ")}`),
    "axe WCAG 2.2 AA violations on the demo's screens",
  ).toEqual([]);
  expect(
    axe.filter((r) => r.passedNodes < 50).map((r) => r.screen),
    "screens where axe saw (almost) nothing of the app",
  ).toEqual([]);
});

const srtTime = (seconds: number) => {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};

/** One subtitle per caption, shown until the next one. */
function toSrt(cues: Cue[], end: number) {
  return cues
    .map((cue, i) => `${i + 1}\n${srtTime(cue.at)} --> ${srtTime(cues[i + 1]?.at ?? end)}\n${cue.text}\n`)
    .join("\n");
}

/** The submission needs MP4: H.264 with the captions also as a Polish subtitle track. Without ffmpeg the WebM stays. */
function saveMp4(webm: string, srt: string) {
  const mp4 = webm.replace(/\.webm$/, ".mp4");
  const result = spawnSync(
    "ffmpeg",
    [
      ...["-y", "-loglevel", "error", "-i", webm, "-i", srt],
      ...["-map", "0:v", "-map", "1:s", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p"],
      ...["-c:s", "mov_text", "-metadata:s:s:0", "language=pol", "-movflags", "+faststart", mp4],
    ],
    { stdio: "inherit" },
  );
  if (result.error || result.status !== 0) {
    console.warn(
      "ffmpeg not available or failed — only the WebM was saved. Convert it before submitting: " +
        `ffmpeg -i ${webm} -c:v libx264 -pix_fmt yuv420p -movflags +faststart ${mp4}`,
    );
    return;
  }
  console.log(`MP4 → ${mp4}`);
}
