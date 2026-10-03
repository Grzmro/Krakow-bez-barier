import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { components, PlaceList, PlaceSummary } from "@krakow-bez-barier/contracts";
import { expect, test, type APIRequestContext, type Frame, type Locator, type Page } from "@playwright/test";
import { pl } from "../../src/i18n/pl";

// Walks the demo scenario from docs/demo-script.md and records it as a 1080p video: the app runs
// in a phone-sized frame, the scene caption sits beside it. The final video (KBB-31) then only
// needs a voice-over. Scene numbers and captions match the script.
//
// Real data only: every place is looked up in the API by name (or, for the disagreement, by its facts), never by a
// sample id, and the recording stops with an error when the database or a place is missing.

const PLACES = {
  /** A hotel with OSM facts and a check date. */
  facts: "Qubus",
  /** OSM says only wheelchair=yes: every concrete barrier is "Brak danych". */
  incomplete: "Hotel Miodowa",
};
/**
 * A public toilet where the city (krakow.pl list: adapted) and OSM (`wheelchair=limited`) disagree; the one nearest
 * to `near` (the Sukiennice toilet on Rynek Główny). The city list was last updated on 2025-09-15, over a year ago,
 * so its fact is "Nieaktualne" and the fresh OSM fact decides — the card shows both with their dates.
 */
const DISAGREEMENT = { category: "toilet", attribute: "wheelchair_overall", near: "19.9375,50.0622" } as const;
/** The source the outage server reports as down (SIMULATE_SOURCE_OUTAGE in playwright.demo.config.ts). */
const OUTAGE_SOURCE = "krakow.pl Kraków bez barier: Toalety ogólnodostępne";
const SETUP_HINT =
  "Load the data first: `npm run db:setup`, `npm run ingest -- --city krakow --source osm` and `--source krakow-pl-toilets` (docs/demo-script.md).";

const MAX_SECONDS = 180;
// DEMO_PACE=0.2 shortens every pause, for checking the walkthrough without waiting 3 minutes.
const PACE = Number(process.env.DEMO_PACE) > 0 ? Number(process.env.DEMO_PACE) : 1;
const OUT_DIR = path.join(__dirname, "..", "..", "demo-output");
const VIDEO = { width: 1920, height: 1080 };
const PHONE = { width: 412, height: 915 };

// Recording-only page around the app; never served by the app itself.
const STAGE_HTML = `<!doctype html><html lang="pl"><meta charset="utf-8"><title>Kraków bez barier — demo</title>
<style>
  body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center; gap: 96px;
    background: radial-gradient(circle at 30% 20%, #3b2a7a, #120d26 70%); font-family: system-ui, sans-serif; color: #fff; }
  .phone { padding: 14px; border-radius: 56px; background: #0b0b10; box-shadow: 0 30px 80px rgba(0,0,0,.55), inset 0 0 0 2px #2a2a35; }
  iframe { display: block; width: ${PHONE.width}px; height: ${PHONE.height}px; border: 0; border-radius: 42px; background: #fff; }
  .side { width: 640px; }
  .brand { font-size: 28px; font-weight: 800; opacity: .9; }
  #scene { margin-top: 56px; font-size: 22px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #c4b5fd; }
  #text { margin-top: 16px; font-size: 40px; font-weight: 650; line-height: 1.25; }
</style>
<div class="phone"><iframe id="phone" name="phone" title="Aplikacja Kraków bez barier"></iframe></div>
<div class="side" aria-live="off"><div class="brand">Kraków bez barier</div><div id="scene"></div><div id="text"></div></div>
</html>`;

let startedAt = 0;
const elapsed = () => (Date.now() - startedAt) / 1000;
const pause = (page: Page, seconds: number) => page.waitForTimeout(seconds * 1000 * PACE);

/** Fails with what to do when the app can't read its database, instead of recording empty screens. */
async function requireDatabase(request: APIRequestContext) {
  const response = await request.get("/api/v1/health");
  const health = (await response.json().catch(() => null)) as components["schemas"]["Health"] | null;
  const database = health?.checks?.database;
  if (database?.status !== "up") {
    throw new Error(
      `The demo records real data, but the app's database is ${database?.status ?? `unreachable (health ${response.status()})`}` +
        `${database?.detail ? ` — ${database.detail.replace(/\.$/, "")}` : ""}. Set DATABASE_URL in the root .env. ${SETUP_HINT}`,
    );
  }
}

async function listPlacesPage(request: APIRequestContext, query: string): Promise<PlaceList> {
  const response = await request.get(`/api/v1/places?${query}`);
  expect(response.ok(), `GET /api/v1/places?${query} answered ${response.status()}`).toBe(true);
  return (await response.json()) as PlaceList;
}

/** The first place that `matches`, following `nextCursor` through every page of the query. */
async function findPlace(request: APIRequestContext, query: string, matches: (place: PlaceSummary) => boolean) {
  let cursor: string | null | undefined;
  do {
    const page = await listPlacesPage(request, cursor ? `${query}&cursor=${encodeURIComponent(cursor)}` : query);
    const found = page.items.find(matches);
    if (found) return found;
    cursor = page.nextCursor;
  } while (cursor);
  return undefined;
}

async function placeNamed(request: APIRequestContext, name: string): Promise<PlaceSummary> {
  const place = await findPlace(request, `q=${encodeURIComponent(name)}&limit=50`, (p) => p.name === name && !p.isSample);
  if (!place) throw new Error(`The demo place "${name}" is not in the database. ${SETUP_HINT}`);
  return place;
}

/** The toilet nearest to `DISAGREEMENT.near` whose two sources give different values for the attribute. */
async function disagreementPlace(request: APIRequestContext): Promise<PlaceSummary> {
  const { category, attribute, near } = DISAGREEMENT;
  const page = await listPlacesPage(request, `category=${category}&near=${near}&limit=50`);
  for (const summary of page.items.filter((p) => !p.isSample && p.summary.some((chip) => chip.attribute === attribute))) {
    const response = await request.get(`/api/v1/places/${summary.id}`);
    const place = (await response.json()) as components["schemas"]["Place"];
    const facts = place.attributes.find((a) => a.attribute === attribute)?.facts ?? [];
    const values = new Set(facts.map((f) => JSON.stringify(f.value)));
    if (new Set(facts.map((f) => f.source.id)).size > 1 && values.size > 1) return summary;
  }
  throw new Error(`No ${category} near ${near} where two sources disagree on "${attribute}" (krakow.pl toilets vs OSM). ${SETUP_HINT}`);
}

/** Shows the scene caption beside the phone, so the silent recording can be followed and voiced over. */
async function caption(page: Page, scene: string, text: string) {
  const at = elapsed();
  console.log(`${Math.floor(at / 60)}:${String(Math.floor(at % 60)).padStart(2, "0")}  ${scene} — ${text}`);
  await page.evaluate(
    ({ scene, text }) => {
      document.getElementById("scene")!.textContent = scene;
      document.getElementById("text")!.textContent = text;
    },
    { scene, text },
  );
}

/**
 * Marks where the "finger" taps before clicking — the recording has no mouse cursor. `enter`
 * activates the control from the keyboard instead, for buttons inside an animating drawer.
 */
async function tap(page: Page, target: Locator, how: "click" | "enter" = "click") {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box) {
    await page.evaluate(({ x, y }) => {
      const dot = document.createElement("div");
      dot.style.cssText =
        `position:fixed;left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;border-radius:50%;` +
        "z-index:1;pointer-events:none;background:rgba(124,58,237,.35);border:3px solid #7c3aed;" +
        "transition:opacity .6s,transform .6s";
      document.body.appendChild(dot);
      setTimeout(() => {
        dot.style.opacity = "0";
        dot.style.transform = "scale(1.6)";
      }, 500);
      setTimeout(() => dot.remove(), 1200);
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }
  await pause(page, 0.6);
  if (how === "enter") await target.press("Enter");
  else await target.click();
}

async function typeSlowly(page: Page, target: Locator, text: string) {
  await tap(page, target);
  await target.pressSequentially(text, { delay: 140 * PACE });
}

/** The app is on real data: no PRZYKŁAD tag anywhere on the screen. */
async function expectNoSampleLabel(app: Frame) {
  await expect(app.getByText(pl.common.sample.tag, { exact: true })).toHaveCount(0);
}

test("record the demo walkthrough", async ({ browser, baseURL, request }) => {
  // GIVEN the app answers from a database that holds the demo places
  await requireDatabase(request);
  const facts = await placeNamed(request, PLACES.facts);
  const incomplete = await placeNamed(request, PLACES.incomplete);
  const disagreement = await disagreementPlace(request);
  const outageURL = process.env.DEMO_OUTAGE_BASE_URL;
  if (!outageURL) console.warn("DEMO_OUTAGE_BASE_URL is not set: the recording skips the unavailable-source scene.");

  // The video starts with the context, so caption times and the length check count from here.
  startedAt = Date.now();
  const context = await browser.newContext({
    viewport: VIDEO,
    recordVideo: { dir: test.info().outputPath("video"), size: VIDEO },
  });
  const page = await context.newPage();
  const stage = new URL("/__demo-stage", baseURL).toString();
  await page.route(stage, (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: STAGE_HTML }));
  await page.goto(stage);
  const app: Frame = page.frame({ name: "phone" })!;
  const open = async (url: string, base = baseURL) => {
    await app.goto(new URL(url, base).toString());
  };
  const list = app.getByRole("region", { name: "Lista miejsc" });
  const factRow = (label: string) => app.getByRole("button", { name: new RegExp(`^${label}:`) });

  // 1. Who and what they need
  await open("/");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText(/^\d+ miejsc/);
  await expectNoSampleLabel(app);
  await caption(page, "1 · Dla kogo", "Osoba na wózku sprawdza, czy miejsce w Krakowie pasuje do jej potrzeb. Bez konta.");
  await pause(page, 6);
  await caption(page, "1 · Dla kogo", "Wybiera profil „Wózek” — tylko progi: stopnie, szerokość drzwi, toaleta. Bez pytań o niepełnosprawność.");
  await tap(page, app.getByRole("radio", { name: "Wózek", exact: true }));
  await pause(page, 3);
  await tap(page, app.getByRole("button", { name: "Progi profilu" }));
  const thresholds = app.getByRole("dialog", { name: "Progi profilu" });
  await expect(thresholds).toBeVisible();
  await pause(page, 5);
  await tap(page, thresholds.getByRole("button", { name: "Gotowe" }));
  await expect(thresholds).toBeHidden();

  // 2. Find a real place: list and map show the same results, each with a verdict
  await caption(page, "2 · Miejsce", `Szuka hotelu ${facts.name}. Prawdziwe miejsca z OpenStreetMap — wynik na liście i na mapie.`);
  await typeSlowly(page, app.getByRole("combobox", { name: "Wyszukaj miejsce" }), facts.name);
  const row = list.getByRole("listitem").filter({ has: app.getByRole("link", { name: new RegExp(facts.name) }) }).first();
  await expect(row).toBeVisible();
  await expect(app.locator(`[data-place-id="${facts.id}"]`)).toHaveCount(1);
  await pause(page, 4);
  await caption(page, "2 · Miejsce", "Werdykt dla jej progów jest słowem, nie kolorem — a „Dlaczego?” mówi, czego brakuje.");
  await tap(page, list.getByRole("button", { name: "Rozwiń arkusz" }));
  await tap(page, row.getByRole("button", { name: new RegExp(`^Dlaczego ${facts.name} `) }));
  await pause(page, 7);

  // 3. Concrete facts with source, date and reliability
  await tap(page, row.getByRole("link", { name: new RegExp(facts.name) }));
  await expect(app.getByRole("heading", { level: 1, name: facts.name })).toBeVisible();
  await expectNoSampleLabel(app);
  await caption(page, "3 · Konkretne fakty", "Karta miejsca: konkretne cechy, nie etykieta „dostępne”. Czego nie wiemy, to „Brak danych”.");
  await pause(page, 6);
  const levels = factRow(pl.common.attribute.levels);
  await tap(page, levels);
  const levelsPanel = app.locator(`#${await levels.getAttribute("aria-controls")}`);
  await expect(levelsPanel).toContainText("OpenStreetMap");
  await expect(levels).toHaveAccessibleName(new RegExp(pl.common.reliability.unverified));
  await caption(page, "3 · Skąd wiemy?", "Każda cecha ma źródło, datę i wiarygodność: tu OpenStreetMap, jedno źródło społeczności — więc „Niezweryfikowane”.");
  await pause(page, 8);

  // 4. Failure cases: missing data, conflict, unavailable source
  await open(`/miejsca/${incomplete.id}`);
  await expect(app.getByRole("heading", { level: 1, name: incomplete.name })).toBeVisible();
  await expect(factRow(pl.common.attribute.door_width_cm)).toContainText(pl.common.status.unknown);
  await caption(page, "4 · Niepełne dane", `${incomplete.name}: o stopniach, drzwiach i windzie nie wiemy nic — „Brak danych” na szaro, nigdy „dostępne”.`);
  await pause(page, 8);

  await open(`/miejsca/${disagreement.id}`);
  await expect(app.getByRole("heading", { level: 1, name: disagreement.name })).toBeVisible();
  const overall = factRow(pl.common.attribute.wheelchair_overall);
  await expect(overall).toContainText(pl.place.overall.limited);
  await caption(page, "4 · Rozbieżne dane", "Toaleta w Sukiennicach: OpenStreetMap mówi „częściowo”, lista miasta (krakow.pl, 15.09.2025) — „dostosowana”. Pokazujemy obie wersje; dane miasta są starsze niż rok, więc „Nieaktualne”.");
  await pause(page, 4);
  await tap(page, overall);
  await pause(page, 8);

  // 5. Correcting data
  await caption(page, "5 · Zgłoszenie", "Każdy może poprawić dane: „To się nie zgadza” — trzy kroki, bez konta.");
  const overallRow = app.locator("li").filter({ has: overall });
  await tap(page, overallRow.getByRole("button", { name: "To się nie zgadza" }));
  const report = app.getByRole("dialog", { name: "To się nie zgadza" });
  await expect(report).toBeVisible();
  await pause(page, 3);
  // The radio input is visually hidden; the visible target is its label.
  const accessible = app.getByRole("radio", { name: pl.place.overall.yes, exact: true });
  await tap(page, report.locator("label").filter({ has: accessible }));
  await expect(accessible).toBeChecked();
  await pause(page, 2);
  await tap(page, report.getByRole("button", { name: "Wyślij" }), "enter");
  await expect(report).toBeHidden();
  await caption(page, "5 · Zgłoszenie", "Zgłoszenie jest „Niezweryfikowane” i czeka na moderację — nie zmienia danych od razu.");
  await expect(overallRow).toContainText(pl.common.reliability.unverified);
  await pause(page, 7);

  if (outageURL) {
    await open(`/miejsca/${disagreement.id}`, outageURL);
    await expect(app.getByRole("heading", { level: 1, name: disagreement.name })).toBeVisible();
    await expect(app.getByText(pl.place.outage.source(OUTAGE_SOURCE)).first()).toBeVisible();
    await expect(app.getByText(pl.place.outage.title(""))).toBeVisible();
    await caption(page, "4 · Źródło niedostępne", "Symulujemy awarię serwisu krakow.pl. Ta sama toaleta: dane miasta zostają, z datą i jako „Nieaktualne”.");
    await pause(page, 8);
    await open("/o-danych", outageURL);
    await caption(page, "6 · Źródła danych", "OpenStreetMap, BIP i krakow.pl: licencja, odświeżanie, status — także awaria. Warstwa MSIP bez licencji jest wyłączona.");
    await pause(page, 6);
  } else {
    await open("/o-danych");
    await caption(page, "6 · Źródła danych", "OpenStreetMap, BIP i krakow.pl: licencja, odświeżanie i status każdego źródła. Warstwa MSIP bez licencji jest wyłączona.");
    await pause(page, 6);
  }

  // 6. Where the data comes from
  await app.getByRole("heading", { name: "Jak liczymy wiarygodność" }).scrollIntoViewIfNeeded();
  await pause(page, 5);

  // 7. Widget and API for businesses, on the hotel from scene 2
  await open(`/dla-firm?miejsce=${encodeURIComponent(facts.id)}`);
  await expect(app.frameLocator("iframe").getByRole("heading", { name: facts.name })).toBeVisible();
  await expectNoSampleLabel(app);
  await caption(page, "7 · Dla firm", `Obiekt wkleja na swojej stronie widget z aktualną kartą — tu z danymi ${facts.name}. Do tego API tylko do odczytu.`);
  await pause(page, 7);
  await app.getByRole("heading", { name: "Dla obiektów" }).scrollIntoViewIfNeeded();
  await caption(page, "7 · Model biznesowy", "Płacą obiekty: karta na stronie i weryfikacja na miejscu. Dla mieszkańców dane są bezpłatne.");
  await pause(page, 7);

  // 8. Accessibility of the app itself
  await open("/");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText(/miejsc/);
  await caption(page, "8 · Dostępność", "Cała aplikacja działa z klawiatury: link „Przejdź do treści”, widoczny fokus, statusy jako tekst.");
  await page.locator("#phone").focus();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    await pause(page, 1.2);
  }
  await app.getByRole("button", { name: "Menu" }).focus();
  await page.keyboard.press("Enter");
  const statement = app.getByRole("link", { name: /^Deklaracja dostępności/ });
  await expect(statement).toBeVisible();
  await pause(page, 1.5);
  await statement.focus();
  await pause(page, 1);
  await page.keyboard.press("Enter");
  await expect(app.getByRole("heading", { level: 1, name: "Deklaracja dostępności" })).toBeVisible();
  await caption(page, "8 · Dostępność", "Cel WCAG 2.2 AA, testy axe na każdym ekranie. Uczciwie: co działa, ograniczenia i plan.");
  await pause(page, 6);
  await app.getByRole("heading", { name: "Znane ograniczenia" }).scrollIntoViewIfNeeded();
  await pause(page, 6);

  // 9. Prototype → service
  await open("/");
  await caption(
    page,
    "9 · Od prototypu do usługi",
    "Prowadzi niezależny operator, nie Urząd. Hosting i moderację opłacają obiekty — karty na stronach i weryfikacje.",
  );
  await pause(page, 7);
  await caption(
    page,
    "9 · Od prototypu do usługi",
    "Plan: pilotaż w Krakowie, panel właściciela obiektu. Kolejne miasto: konfiguracja otwartych źródeł i lokalny moderator.",
  );
  await pause(page, 7);
  await caption(page, "Kraków bez barier", "Konkretne fakty, źródło przy każdej informacji, otwarte dane. Dziękujemy!");
  await pause(page, 4);

  const seconds = elapsed();
  const video = page.video()!;
  await context.close();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const webm = path.join(OUT_DIR, "kbb-demo.webm");
  await video.saveAs(webm);
  console.log(`Demo recorded in ${seconds.toFixed(0)} s → ${webm}`);
  saveMp4(webm);
  expect(seconds, `the demo must fit in ${MAX_SECONDS} s`).toBeLessThanOrEqual(MAX_SECONDS);
});

/** The submission needs MP4; convert when ffmpeg is installed, otherwise keep the WebM. */
function saveMp4(webm: string) {
  const mp4 = webm.replace(/\.webm$/, ".mp4");
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4],
    { stdio: "inherit" },
  );
  if (result.error || result.status !== 0) {
    console.warn("ffmpeg not available or failed — only the WebM was saved. Convert it to MP4 before submitting.");
    return;
  }
  console.log(`MP4 → ${mp4}`);
}
