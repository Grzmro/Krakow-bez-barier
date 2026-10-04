import fs from "node:fs";
import path from "node:path";
import type { PlaceList, PlaceSummary } from "@krakow-bez-barier/contracts";
import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from "@playwright/test";
import { pl } from "../../src/i18n/pl";

// Raw screen captures for the final demo video (`npm run demo:video`, docs/demo-script.md → "Wideo z lektorem").
// No captions or overlays on the page: the Remotion project in /video frames the captures (phone, browser window),
// zooms on the logged taps, adds the cursor, captions and the voice. Each scene's span in the capture lasts
// max(its actions, the scene's voice-over), so picture and voice line up by construction; the spans and taps go to
// capture.json. Real data only (the database behind the app); the only write is "Nadal aktualne", a confirmation.

const VIDEO_DIR = path.resolve(process.env.DEMO_REMOTION_DIR ?? path.join(__dirname, "..", "..", "..", "..", "video"));
const VOICE = JSON.parse(fs.readFileSync(path.join(VIDEO_DIR, "public", "voice", "voice.json"), "utf8")) as Record<string, { total: number }>;
const OUT = path.join(VIDEO_DIR, "public", "capture");
// Quick walkthrough check: no waiting for the voice.
const FAST = process.env.DEMO_FAST === "1";
const PHONE = { width: 412, height: 915 };
const DESKTOP = { width: 1600, height: 900 };
// Where the device position is stubbed to: the Planty, a few steps from the Old Town's busiest streets.
const LOCATION = { latitude: 50.0614, longitude: 19.9383 };
const HANGAR = "Hangar Czyżyny Oddział Muzeum Inżynierii Miejskiej";

type Tap = { t: number; x: number; y: number };
type Span = { id: string; device: "phone" | "desktop"; start: number; end: number; taps: Tap[] };

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

test("capture the demo scenes", async ({ browser, baseURL, request }) => {
  const hangar = await requireData(request);
  fs.mkdirSync(OUT, { recursive: true });
  const spans: Span[] = [];
  for (const device of (process.env.DEMO_SEGMENTS ?? "phone,desktop").split(",") as Span["device"][]) {
    spans.push(...(await capture(browser, baseURL!, device, hangar)));
  }
  // A partial run (DEMO_SEGMENTS) keeps the other device's spans from the previous capture.
  const file = path.join(OUT, "capture.json");
  const done = new Set(spans.map((s) => s.device));
  const kept = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Span[]).filter((s) => !done.has(s.device)) : [];
  fs.writeFileSync(file, `${JSON.stringify([...kept, ...spans], null, 2)}\n`);
});

async function capture(browser: Browser, baseURL: string, device: Span["device"], hangar: PlaceSummary): Promise<Span[]> {
  const viewport = device === "phone" ? PHONE : DESKTOP;
  const context = await browser.newContext({
    viewport,
    locale: "pl-PL",
    geolocation: LOCATION,
    permissions: ["geolocation"],
    recordVideo: { dir: test.info().outputPath(`video-${device}`), size: viewport },
  });
  // Warm-up on a throwaway page of the same context (its video is discarded): the map tiles land in the cache, so the
  // recorded page doesn't open on a half-drawn map.
  const warm = await context.newPage();
  for (const url of device === "phone" ? ["/", `/miejsca/${encodeURIComponent(hangar.id)}`] : ["/trasa?z=station", "/"]) {
    await warm.goto(new URL(url, baseURL).toString());
    await warm.waitForTimeout(5000);
  }
  await warm.close();

  const page = await context.newPage();
  const startedAt = Date.now();
  const elapsed = () => (Date.now() - startedAt) / 1000;
  const pause = (seconds: number) => page.waitForTimeout(FAST ? Math.min(seconds, 0.3) * 1000 : seconds * 1000);
  const open = (url: string) => page.goto(new URL(url, baseURL).toString());
  const spans: Span[] = [];
  let taps: Tap[] = [];
  let sceneStart = 0;

  /** Logs the tap position (the video's cursor and zoom follow it), then clicks. */
  const tap = async (target: Locator) => {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    await pause(0.5);
    if (box) taps.push({ t: elapsed() - sceneStart, x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await target.click();
  };
  const typeSlowly = async (target: Locator, text: string) => {
    await tap(target);
    await target.pressSequentially(text, { delay: FAST ? 20 : 95 });
  };
  const scrollTo = async (target: Locator) => {
    await expect(target.first()).toBeVisible();
    await target.first().evaluate((el) => el.scrollIntoView({ block: "start", behavior: "smooth" }), undefined, { timeout: 15_000 });
    await pause(0.9);
  };
  /** The capture runs on a local server: blur its address wherever the page prints it (share link, embed code). */
  const blurLocalAddress = () =>
    page.evaluate((host) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.textContent?.includes(host) && node.parentElement) node.parentElement.style.filter = "blur(7px)";
      }
    }, new URL(baseURL).host);

  /** A scene: `prepare` (loading, not shown) → mark → actions → hold until the voice-over has finished → mark. */
  const scene = async (id: string, prepare: () => Promise<void>, actions: () => Promise<void>) => {
    const voice = VOICE[id]?.total;
    if (!voice) throw new Error(`No voice-over for scene ${id}; run the voice step first.`);
    await prepare();
    sceneStart = elapsed();
    taps = [];
    await actions();
    const wait = sceneStart + voice - elapsed();
    if (wait > 0 && !FAST) await page.waitForTimeout(wait * 1000);
    spans.push({ id, device, start: sceneStart, end: elapsed(), taps });
    console.log(`${device} ${id}: ${sceneStart.toFixed(1)}–${elapsed().toFixed(1)} s (voice ${voice.toFixed(1)} s)`);
  };
  const ready = async (url: string, check: Locator) => {
    await open(url);
    await expect(check).toBeVisible();
    await pause(1.5);
  };
  const factRow = (label: string) => page.getByRole("button", { name: new RegExp(`^${label}`) });
  const noSample = () => expect(page.getByText(pl.common.sample.tag, { exact: true })).toHaveCount(0);
  const searchBox = page.getByRole("combobox", { name: "Wyszukaj miejsce" });

  if (device === "phone") {
    await scene(
      "start",
      () => ready("/", page.getByText("Najbliżej Ciebie")),
      async () => {
        await noSample();
        await pause(3);
        await tap(page.getByRole("radio", { name: "Wózek", exact: true }));
        await expect(page.getByRole("radio", { name: "Wózek", exact: true })).toBeChecked();
        await pause(1.5);
        await tap(page.getByRole("button", { name: pl.home.map.zoomIn }));
      },
    );

    await scene(
      "search",
      () => ready("/", searchBox),
      async () => {
        await typeSlowly(searchBox, "restauracja");
        await expect(page.getByRole("option", { name: /Kategoria: Restauracje/ })).toBeVisible();
        await pause(2);
        await searchBox.press("Escape");
        const show = page.getByRole("button", { name: /^Pokaż wyniki \(\d+\)/ });
        await expect(show).toBeVisible();
        await pause(1);
        await tap(show);
        await expect(page.getByRole("heading", { level: 2, name: /\d+ miejsc/ })).toBeVisible();
      },
    );

    await scene(
      "toilet",
      () => ready("/", page.getByText("Najbliżej Ciebie")),
      async () => {
        await pause(0.8);
        await tap(page.getByRole("button", { name: pl.home.quick.actions.toilet.label }));
        await expect(page.getByRole("link", { name: pl.home.quick.details })).toBeVisible();
      },
    );

    await scene(
      "card",
      async () => {
        await page.getByRole("link", { name: pl.home.quick.details }).click();
        await expect(page.getByRole("heading", { level: 1, name: "Toaleta publiczna" })).toBeVisible();
        await pause(1);
      },
      async () => {
        await pause(2);
        await scrollTo(page.getByRole("heading", { name: "Fakty" }));
        await tap(factRow("Ogólna dostępność"));
        await pause(3.5);
        await scrollTo(page.getByRole("heading", { name: pl.place.why.title }));
      },
    );

    await scene(
      "report",
      () => scrollTo(factRow("Winda")),
      async () => {
        await pause(0.8);
        await tap(page.getByRole("button", { name: pl.place.confirm }).nth(1));
        // A second capture from the same network the same day meets the daily limit instead; either way a note shows.
        await expect(page.getByText(new RegExp(`${pl.place.mine.sentConfirmation}|${pl.place.confirmed}|${pl.place.confirmLimited}`)).first()).toBeVisible();
        await pause(2.5);
        await tap(page.getByRole("button", { name: pl.place.notRight }).nth(1));
        await expect(page.getByRole("dialog", { name: pl.place.report.titleCorrect })).toBeVisible();
      },
    );

    await scene(
      "museum",
      async () => {
        await page.keyboard.press("Escape");
        await ready(`/miejsca/${encodeURIComponent(hangar.id)}`, page.getByRole("heading", { level: 1, name: HANGAR }));
      },
      async () => {
        await noSample();
        await pause(2.5);
        await scrollTo(page.getByRole("heading", { name: "Fakty" }));
        const lift = factRow(pl.common.attribute.lift);
        await tap(lift);
        await expect(page.locator(`#${await lift.getAttribute("aria-controls")}`)).toContainText("BIP Miasta Krakowa");
      },
    );

    await scene(
      "share",
      () => scrollTo(page.getByRole("heading", { level: 1 })),
      async () => {
        await tap(page.getByRole("button", { name: pl.share.button }));
        await expect(page.getByRole("img", { name: pl.share.qrLabel }).first()).toBeVisible();
        await blurLocalAddress();
      },
    );
  } else {
    await scene(
      "route",
      () => ready("/trasa?z=station", page.getByRole("combobox", { name: "Start" })),
      async () => {
        await pause(1);
        await tap(page.getByRole("radio", { name: /Wózek/ }).first());
        await expect(page.getByText(/^Brak znanych barier|^Nie spełnia|bez danych$/).first()).toBeVisible({ timeout: 30_000 });
        await noSample();
        await pause(2.5);
      },
    );

    await scene(
      "go",
      () => pause(0.2),
      async () => {
        await tap(page.getByRole("button", { name: "Ruszamy" }));
        await expect(page.getByRole("heading", { level: 1, name: "Prowadzenie" })).toBeVisible();
      },
    );

    await scene(
      "trust",
      () => ready("/o-danych", page.getByRole("heading", { level: 1, name: "O danych" })),
      async () => {
        await pause(2.5);
        await tap(page.getByRole("link", { name: pl.quality.aboutLink }));
        await expect(page.getByRole("heading", { level: 1, name: pl.quality.title })).toBeVisible();
        await pause(2);
        await page.evaluate(() => window.scrollBy({ top: 420, behavior: "smooth" }));
      },
    );

    await scene(
      "business",
      async () => {
        await ready(`/dla-firm?miejsce=${encodeURIComponent(hangar.id)}`, page.frameLocator("iframe").first().getByRole("heading", { name: HANGAR }));
        await blurLocalAddress();
      },
      async () => {
        await noSample();
        await pause(4.5);
        await page.evaluate(() => window.scrollBy({ top: 650, behavior: "smooth" }));
        await pause(1);
        await blurLocalAddress();
      },
    );

    await scene(
      "keyboard",
      () => ready("/", page.getByText("Najbliżej Ciebie")),
      async () => {
        await pause(0.8);
        await page.keyboard.press("Tab");
        await expect(page.getByRole("link", { name: "Przejdź do treści" })).toBeFocused();
        await pause(1.2);
        for (let i = 0; i < 4; i++) {
          await page.keyboard.press("Tab");
          await pause(0.6);
        }
      },
    );
  }

  const video = page.video()!;
  await context.close();
  await video.saveAs(path.join(OUT, `${device}.webm`));
  return spans;
}
