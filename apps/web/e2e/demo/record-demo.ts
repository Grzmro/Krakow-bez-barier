import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Frame, type Locator, type Page } from "@playwright/test";

// Walks the demo scenario from docs/demo-script.md and records it as a 1080p video: the app runs
// in a phone-sized frame, the scene caption sits beside it. The final video (KBB-31) then only
// needs a voice-over. Scene numbers and captions match the script.

// The demo runs on the sample places served by the mock API (TODO(KBB-28): switch to the real
// demo places from docs/demo-data.md once the data API serves them).
const PLACES = {
  hotel: { id: "hotel-przyklad", name: "Hotel Przykład", query: "Hotel" },
  conflict: { id: "palac-krzysztofory", name: "Pałac Krzysztofory" },
  incomplete: { id: "kawiarnia-przyklad", name: "Kawiarnia Przykład" },
};

const MAX_SECONDS = 180;
// DEMO_PACE=0.2 shortens every pause, for checking the walkthrough without waiting 3 minutes.
const PACE = Number(process.env.DEMO_PACE ?? 1);
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

test("record the demo walkthrough", async ({ browser, baseURL }) => {
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
  const open = (url: string) => app.goto(new URL(url, baseURL).toString());
  const list = app.getByRole("region", { name: "Lista miejsc" });

  // 1. Who and what they need
  await open("/");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText(/miejsc/);
  await caption(page, "1 · Dla kogo", "Osoba na wózku sprawdza, czy miejsce w Krakowie pasuje do jej potrzeb. Bez konta.");
  await pause(page, 7);
  await caption(page, "1 · Dla kogo", "Wybiera profil „Wózek” — tylko progi: stopnie, szerokość drzwi, toaleta. Bez pytań o niepełnosprawność.");
  await tap(page, app.getByRole("radio", { name: "Wózek", exact: true }));
  await pause(page, 3);
  await tap(page, app.getByRole("button", { name: "Progi profilu" }));
  const thresholds = app.getByRole("dialog", { name: "Progi profilu" });
  await expect(thresholds).toBeVisible();
  await pause(page, 6);
  await tap(page, thresholds.getByRole("button", { name: "Gotowe" }));
  await expect(thresholds).toBeHidden();

  // 2. Find a place: list and map show the same results, each with a verdict
  await caption(page, "2 · Miejsce", "Szuka hotelu. Wynik jest na liście i na mapie — lista to tekstowa wersja mapy.");
  await typeSlowly(page, app.getByRole("combobox", { name: "Wyszukaj miejsce" }), PLACES.hotel.query);
  await pause(page, 1.5);
  await tap(page, app.getByRole("option", { name: PLACES.hotel.name }));
  await expect(list.getByRole("heading", { level: 2 })).toHaveText("1 miejsce");
  await pause(page, 5);
  await caption(page, "2 · Miejsce", "„Spełnia · niepotwierdzone” — i od razu widać dlaczego.");
  await tap(page, list.getByRole("button", { name: "Rozwiń arkusz" }));
  await tap(page, list.getByRole("button", { name: `Dlaczego? ${PLACES.hotel.name}` }));
  await pause(page, 8);

  // 3. Concrete facts with source, date and reliability
  await caption(page, "3 · Konkretne fakty", "Karta miejsca: stopnie, drzwi, winda, toaleta — konkretne wartości, nie etykieta „dostępne”.");
  await tap(page, list.getByRole("link", { name: new RegExp(PLACES.hotel.name) }));
  await expect(app.getByRole("heading", { level: 1, name: PLACES.hotel.name })).toBeVisible();
  await pause(page, 7);
  const door = app.getByRole("button", { name: /Szerokość drzwi/ });
  await caption(page, "3 · Skąd wiemy?", "Każda cecha ma źródło, datę i wiarygodność. Dane przykładowe są oznaczone „Przykład”.");
  await tap(page, door);
  await pause(page, 7);
  const lift = app.getByRole("button", { name: /^Winda/ });
  await caption(page, "3 · Skąd wiemy?", "Winda z OpenStreetMap: „Niezweryfikowane” — jedno źródło społeczności, nie gwarancja.");
  await tap(page, lift);
  await pause(page, 7);

  // 4. Failure cases: missing data, unavailable source, conflict
  await open(`/miejsca/${PLACES.incomplete.id}`);
  await expect(app.getByRole("heading", { level: 1, name: PLACES.incomplete.name })).toBeVisible();
  await caption(page, "4 · Niepełne dane", "Brak informacji to „Brak danych” na szaro — nigdy „dostępne”. Można zapytać obiekt albo uzupełnić.");
  await pause(page, 9);

  await open(`/miejsca/${PLACES.conflict.id}`);
  await expect(app.getByRole("heading", { level: 1, name: PLACES.conflict.name })).toBeVisible();
  await caption(page, "4 · Źródło niedostępne", "Źródło miejskie (MSIP) nie odpowiada: pokazujemy ostatnie dane z datą i jako nieaktualne.");
  await pause(page, 8);
  const toilet = app.getByRole("button", { name: /Toaleta dostosowana/ });
  await caption(page, "4 · Sprzeczne dane", "Dwa źródła mówią co innego o toalecie — pokazujemy obie wartości, nie wybieramy za użytkownika.");
  await tap(page, toilet);
  await pause(page, 9);

  // 5. Correcting data
  await caption(page, "5 · Zgłoszenie", "Każdy może poprawić dane: „To się nie zgadza” — trzy kroki, bez konta.");
  const toiletRow = app.locator("li").filter({ has: toilet });
  await tap(page, toiletRow.getByRole("button", { name: "To się nie zgadza" }));
  const report = app.getByRole("dialog", { name: "To się nie zgadza" });
  await expect(report).toBeVisible();
  await pause(page, 3);
  // The radio input is visually hidden; the visible target is its label.
  const yes = app.getByRole("radio", { name: "Jest dostosowana" });
  await tap(page, report.locator("label").filter({ has: yes }));
  await expect(yes).toBeChecked();
  await pause(page, 2);
  await tap(page, report.getByRole("button", { name: "Wyślij" }), "enter");
  await expect(report).toBeHidden();
  await caption(page, "5 · Zgłoszenie", "Zgłoszenie jest „Niezweryfikowane” i czeka na moderację — nie zmienia danych od razu.");
  await expect(toiletRow).toContainText("Niezweryfikowane");
  await pause(page, 7);

  // 6. Where the data comes from
  await open("/o-danych");
  await caption(page, "6 · Źródła danych", "OpenStreetMap i otwarte dane Krakowa (MSIP): licencja, odświeżanie, status — także awaria.");
  await pause(page, 6);
  await app.getByRole("heading", { name: "Jak liczymy wiarygodność" }).scrollIntoViewIfNeeded();
  await pause(page, 6);

  // 7. Widget and API for businesses
  await open("/dla-firm");
  await caption(page, "7 · Dla firm", "Hotel wkleja widget z aktualną kartą dostępności. Do tego API tylko do odczytu.");
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
  await caption(page, "9 · Od prototypu do usługi", "Otwarte dane zamiast bazy miasta. Kolejne miasto, kategoria czy źródło to konfiguracja.");
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
