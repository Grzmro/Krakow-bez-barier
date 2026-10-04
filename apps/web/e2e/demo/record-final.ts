import fs from "node:fs";
import path from "node:path";
import type { PlaceList, PlaceSummary } from "@krakow-bez-barier/contracts";
import { expect, test, type APIRequestContext, type Browser, type Frame, type Locator, type Page } from "@playwright/test";
import { pl } from "../../src/i18n/pl";
import narration from "./narration.json";

// Records the two picture segments of the final voiced video (`npm run demo:video`, docs/demo-script.md): a phone
// segment (the app in a phone frame, the caption beside it) and a desktop segment (wide layout, caption bar below).
// Every scene stays on screen for max(its actions, the length of its voice-over + a breath), so the picture and the
// voice (synthesized beforehand, scripts/demo-video) line up by construction. The scene start offsets go to
// timeline.json, where scripts/demo-video/assemble.mjs reads them to place each voice-over.
// Real data only (the database behind the app); nothing here writes except "Nadal aktualne", a confirmation.

type Scene = { id: string; segment: "phone" | "desktop"; title: string; text: string };
const SCENES = narration as Scene[];

const OUT_DIR = path.resolve(process.env.DEMO_VIDEO_DIR ?? path.join(__dirname, "..", "..", "demo-output", "video"));
const DURATIONS = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "audio", "durations.json"), "utf8")) as Record<string, number>;
// Quick walkthrough check: no waiting for the voice.
const FAST = process.env.DEMO_FAST === "1";
const BREATH = 0.5;
const VIDEO = { width: 1920, height: 1080 };
const BAR_HEIGHT = 150;
const PHONE = { width: 412, height: 915 };
// Where "Moja lokalizacja" is stubbed to: the Planty, a few steps from the Old Town's busiest streets.
const LOCATION = { latitude: 50.0614, longitude: 19.9383 };
const HANGAR = "Hangar Czyżyny Oddział Muzeum Inżynierii Miejskiej";

const STAGE_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; width: ${VIDEO.width}px; height: ${VIDEO.height}px; overflow: hidden; background: #120d26;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #fff; }
  #app { display: block; border: 0; background: #fff; }
  #scene { font-size: 26px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #c4b5fd; }
  #text { font-weight: 600; }
  #brand { font-size: 24px; font-weight: 700; color: #a78bfa; }
  body.phone { background: radial-gradient(circle at 25% 30%, #3b2a7a, #120d26 70%); }
  body.phone #device { position: absolute; left: 170px; top: ${(VIDEO.height - PHONE.height - 24) / 2}px; transform: scale(1.1);
    width: ${PHONE.width + 24}px; height: ${PHONE.height + 24}px; padding: 12px; border-radius: 52px;
    background: #0b0b10; box-shadow: 0 30px 80px rgba(0,0,0,.55), inset 0 0 0 2px #2a2a35; }
  body.phone #app { width: 100%; height: 100%; border-radius: 40px; }
  body.phone #panel { position: absolute; left: 760px; right: 110px; top: 0; bottom: 0; display: flex; flex-direction: column;
    justify-content: center; gap: 36px; }
  body.phone #text { font-size: 58px; line-height: 1.25; }
  body.desktop #app { position: absolute; left: 0; top: 0; width: ${VIDEO.width}px; height: ${VIDEO.height - BAR_HEIGHT}px; }
  body.desktop #panel { position: absolute; left: 0; right: 0; bottom: 0; height: ${BAR_HEIGHT}px; display: flex; align-items: center;
    gap: 40px; padding: 0 56px; background: #120d26; border-top: 4px solid #7c3aed; }
  body.desktop #scene { flex: 0 0 300px; }
  body.desktop #text { flex: 1; font-size: 31px; line-height: 1.28; }
  body.desktop #brand { display: none; }
`;
const stageHtml = (mode: "phone" | "desktop") => `<!doctype html><html lang="pl"><meta charset="utf-8"><title>Kraków bez barier — demo</title>
<style>${STAGE_CSS}</style>
<body class="${mode}">
<div id="device"><iframe id="app" name="app" title="Aplikacja Kraków bez barier"></iframe></div>
<div id="panel"><div id="scene"></div><div id="text"></div><div id="brand">Kraków bez barier · HackYeah 2026</div></div>
</body></html>`;

type TimelineEntry = Scene & { start: number; end: number; audio: number };

const appFrame = (page: Page) => page.frame({ name: "app" })!;

async function requireData(request: APIRequestContext): Promise<PlaceSummary> {
  const health = await request.get("/api/v1/health");
  const body = (await health.json().catch(() => null)) as { checks?: { database?: { status?: string } } } | null;
  if (body?.checks?.database?.status !== "up") {
    throw new Error("The app's database is not up. Load real data first: npm run db:setup and npm run ingest (docs/demo-script.md).");
  }
  const response = await request.get(`/api/v1/places?q=Hangar&limit=50`);
  const hangar = ((await response.json()) as PlaceList).items.find((p) => p.name === HANGAR && !p.isSample);
  if (!hangar) throw new Error(`The demo place "${HANGAR}" is not in the database (ingest osm and bip-mk).`);
  return hangar;
}

test("record the final video", async ({ browser, baseURL, request }) => {
  const hangar = await requireData(request);
  fs.mkdirSync(path.join(OUT_DIR, "segments"), { recursive: true });
  const timeline: TimelineEntry[] = [];

  for (const segment of (process.env.DEMO_SEGMENTS ?? "phone,desktop").split(",") as ("phone" | "desktop")[]) {
    await recordSegment(browser, baseURL!, segment, hangar, timeline);
  }

  // A partial run (DEMO_SEGMENTS) keeps the other segment's scenes from the previous timeline.
  const timelineFile = path.join(OUT_DIR, "timeline.json");
  const recorded = new Set(timeline.map((t) => t.segment));
  const kept = fs.existsSync(timelineFile)
    ? (JSON.parse(fs.readFileSync(timelineFile, "utf8")) as TimelineEntry[]).filter((t) => !recorded.has(t.segment))
    : [];
  const all = [...timeline, ...kept].sort((a, b) => SCENES.findIndex((s) => s.id === a.id) - SCENES.findIndex((s) => s.id === b.id));
  fs.writeFileSync(timelineFile, `${JSON.stringify(all, null, 2)}\n`);
  for (const t of timeline) {
    console.log(`${t.segment} ${t.start.toFixed(1).padStart(6)}–${t.end.toFixed(1).padStart(6)}  ${t.id}  ${t.title}`);
  }
});

async function recordSegment(browser: Browser, baseURL: string, segment: "phone" | "desktop", hangar: PlaceSummary, timeline: TimelineEntry[]) {
  const context = await browser.newContext({
    viewport: VIDEO,
    locale: "pl-PL",
    geolocation: LOCATION,
    permissions: ["geolocation"],
    recordVideo: { dir: test.info().outputPath(`video-${segment}`), size: VIDEO },
  });
  // Warm-up on a throwaway page of the same context (its own video is discarded): the map tiles of the screens below
  // land in the browser cache, so the recorded page doesn't open on a half-drawn map.
  const warm = await context.newPage();
  await warm.setViewportSize(segment === "phone" ? PHONE : { width: VIDEO.width, height: VIDEO.height - BAR_HEIGHT });
  for (const url of segment === "phone" ? ["/", `/miejsca/${encodeURIComponent(hangar.id)}`] : ["/trasa?z=station", "/"]) {
    await warm.goto(new URL(url, baseURL).toString());
    await warm.waitForTimeout(5000);
  }
  await warm.close();
  const page = await context.newPage();
  const startedAt = Date.now();
  const elapsed = () => (Date.now() - startedAt) / 1000;
  const pause = (seconds: number) => page.waitForTimeout(FAST ? Math.min(seconds, 0.3) * 1000 : seconds * 1000);
  const app = () => appFrame(page);
  const stage = new URL("/__demo-stage", baseURL).toString();
  await page.route(stage, (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: stageHtml(segment) }));
  await page.goto(stage);

  const open = async (url: string) => {
    await app().goto(new URL(url, baseURL).toString());
  };
  /** Marks where the "finger" taps (the recording has no mouse cursor), then clicks. */
  const tap = async (target: Locator) => {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (box) {
      await page.evaluate(
        ({ x, y }) => {
          const dot = document.createElement("div");
          dot.style.cssText =
            `position:fixed;left:${x - 24}px;top:${y - 24}px;width:48px;height:48px;border-radius:50%;` +
            "z-index:10;pointer-events:none;background:rgba(124,58,237,.35);border:3px solid #7c3aed;transition:opacity .6s,transform .6s";
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
    await pause(0.6);
    await target.click();
  };
  const typeSlowly = async (target: Locator, text: string) => {
    await tap(target);
    await target.pressSequentially(text, { delay: FAST ? 20 : 110 });
  };
  /** Scrolls the app frame's own page (not the stage) so `target` is near the top. */
  const scrollTo = async (target: Locator) => {
    await expect(target.first()).toBeVisible();
    await target.first().evaluate((el) => el.scrollIntoView({ block: "start", behavior: "smooth" }), undefined, { timeout: 15_000 });
    await pause(0.9);
  };

  // A scene: caption up, actions run, then the shot stays until the voice-over has finished.
  const scene = async (id: string, actions: (f: () => Frame) => Promise<void>) => {
    const meta = SCENES.find((s) => s.id === id)!;
    const audio = DURATIONS[id];
    if (!audio) throw new Error(`No voice-over duration for scene ${id}; run the synthesis first.`);
    const start = elapsed();
    await page.evaluate(
      ({ title, text }) => {
        document.getElementById("scene")!.textContent = title;
        document.getElementById("text")!.textContent = text;
      },
      { title: meta.title, text: meta.text },
    );
    await actions(app);
    const wait = start + audio + BREATH - elapsed();
    if (wait > 0 && !FAST) await page.waitForTimeout(wait * 1000);
    const end = elapsed();
    timeline.push({ ...meta, start, end, audio });
    console.log(`${segment} ${id}: ${start.toFixed(1)}–${end.toFixed(1)} s (voice ${audio.toFixed(1)} s)`);
  };

  const factRow = (label: string) => app().getByRole("button", { name: new RegExp(`^${label}`) });
  const noSample = async () => expect(app().getByText(pl.common.sample.tag, { exact: true })).toHaveCount(0);

  if (segment === "phone") {
    await scene("p1", async (f) => {
      await open("/");
      await expect(f().getByRole("combobox", { name: "Wyszukaj miejsce" })).toBeVisible();
      await expect(f().getByText("Najbliżej Ciebie")).toBeVisible();
      await noSample();
      await pause(2.5);
      await tap(f().getByRole("radio", { name: "Wózek", exact: true }));
      await expect(f().getByRole("radio", { name: "Wózek", exact: true })).toBeChecked();
      await pause(1.5);
      await tap(f().getByRole("button", { name: pl.home.map.locate }));
      await pause(2);
      await tap(f().getByRole("button", { name: pl.home.map.zoomIn }));
      await pause(1);
      await tap(f().getByRole("button", { name: pl.home.map.zoomIn }));
    });

    await scene("p2", async (f) => {
      await open("/");
      const search = f().getByRole("combobox", { name: "Wyszukaj miejsce" });
      await typeSlowly(search, "restauracja");
      await expect(f().getByRole("option", { name: /Kategoria: Restauracje/ })).toBeVisible();
      await pause(2.2);
      await search.press("Escape");
      const show = f().getByRole("button", { name: /^Pokaż wyniki \(\d+\)/ });
      await expect(show).toBeVisible();
      await pause(1);
      await tap(show);
      await expect(f().getByRole("heading", { level: 2, name: /\d+ miejsc/ })).toBeVisible();
      await pause(1);
    });

    await scene("p3", async (f) => {
      await open("/");
      await tap(f().getByRole("button", { name: pl.home.quick.actions.toilet.label }));
      await expect(f().getByRole("link", { name: pl.home.quick.details })).toBeVisible();
      await pause(2);
    });

    await scene("p4", async (f) => {
      await tap(f().getByRole("link", { name: pl.home.quick.details }));
      await expect(f().getByRole("heading", { level: 1, name: "Toaleta publiczna" })).toBeVisible();
      await pause(2.5);
      await scrollTo(f().getByRole("heading", { name: "Fakty" }));
      await tap(factRow("Ogólna dostępność"));
      await pause(3);
      await scrollTo(f().getByRole("heading", { name: pl.place.why.title }));
    });

    await scene("p5", async (f) => {
      const winda = factRow("Winda");
      await scrollTo(winda);
      await tap(f().getByRole("button", { name: pl.place.notRight }).nth(1));
      const dialog = f().getByRole("dialog", { name: pl.place.report.titleCorrect });
      await expect(dialog).toBeVisible();
      await pause(3);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await pause(0.5);
      await tap(f().getByRole("button", { name: pl.place.confirm }).nth(1));
      // A second recording from the same network the same day meets the daily limit instead; either way a note shows.
      await expect(f().getByText(new RegExp(`${pl.place.mine.sentConfirmation}|${pl.place.confirmed}|${pl.place.confirmLimited}`)).first()).toBeVisible();
    });

    await scene("p6", async (f) => {
      await open(`/miejsca/${encodeURIComponent(hangar.id)}`);
      await expect(f().getByRole("heading", { level: 1, name: HANGAR })).toBeVisible();
      await noSample();
      await pause(3);
      await scrollTo(f().getByRole("heading", { name: "Fakty" }));
      const lift = factRow(pl.common.attribute.lift);
      await tap(lift);
      await expect(f().locator(`#${await lift.getAttribute("aria-controls")}`)).toContainText("BIP Miasta Krakowa");
    });

    await scene("p7", async (f) => {
      await scrollTo(f().getByRole("heading", { level: 1 }));
      await tap(f().getByRole("button", { name: pl.share.button }));
      await expect(f().getByRole("img", { name: pl.share.qrLabel }).first()).toBeVisible();
    });
  } else {
    await scene("d1", async (f) => {
      await open("/trasa?z=station");
      await expect(f().getByRole("combobox", { name: "Start" })).toBeVisible();
      await pause(1.5);
      await tap(f().getByRole("radio", { name: /Wózek/ }).first());
      const summary = f().getByText(/^Brak znanych barier|^Nie spełnia|bez danych$/).first();
      await expect(summary).toBeVisible({ timeout: 30_000 });
      await noSample();
      await pause(4);
    });

    await scene("d2", async (f) => {
      await tap(f().getByRole("button", { name: "Ruszamy" }));
      await expect(f().getByRole("heading", { level: 1, name: "Prowadzenie" })).toBeVisible();
      await pause(3);
    });

    await scene("d3", async (f) => {
      await open("/o-danych");
      await expect(f().getByRole("heading", { level: 1, name: "O danych" })).toBeVisible();
      await pause(3);
      await f().evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
    });

    await scene("d4", async (f) => {
      await open("/o-danych/jakosc");
      await expect(f().getByRole("heading", { level: 1, name: pl.quality.title })).toBeVisible();
      await pause(3);
      await f().evaluate(() => window.scrollBy({ top: 520, behavior: "smooth" }));
    });

    await scene("d5", async (f) => {
      await open(`/dla-firm?miejsce=${encodeURIComponent(hangar.id)}`);
      await expect(f().frameLocator("iframe").first().getByRole("heading", { name: HANGAR })).toBeVisible();
      await noSample();
      await pause(5);
      await f().evaluate(() => window.scrollBy({ top: 700, behavior: "smooth" }));
      await pause(4);
      await open("/api/docs");
    });

    await scene("d6", async (f) => {
      await open("/");
      await expect(f().getByRole("combobox", { name: "Wyszukaj miejsce" })).toBeVisible();
      await expect(f().getByText("Najbliżej Ciebie")).toBeVisible();
      await pause(3);
      await page.locator("#app").focus();
      await page.keyboard.press("Tab");
      await expect(f().getByRole("link", { name: "Przejdź do treści" })).toBeFocused();
      await pause(2.5);
      await open("/deklaracja-dostepnosci");
    });

    await scene("outro", async (f) => {
      await open("/");
      await expect(f().getByRole("combobox", { name: "Wyszukaj miejsce" })).toBeVisible();
    });
  }

  const video = page.video()!;
  await context.close();
  await video.saveAs(path.join(OUT_DIR, "segments", `${segment}.webm`));
}
