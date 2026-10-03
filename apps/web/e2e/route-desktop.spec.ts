import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// The default project emulates a phone; these specs look at the route screen as a laptop or monitor does.
// The route is the recorded Dworzec Główny → Rynek answer (see route.spec.ts).
test.use({ isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

// POST /routes allows 30 requests a minute per client; its own client key keeps this file from using up route.spec's share.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/routes", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-vercel-forwarded-for": "e2e-route-desktop" } }),
  );
});

const WIDTHS = [1024, 1280, 1440, 1920];
const MAP = /^Mapa trasy/;

/** Boxes of the screen's parts, read in one go so a busy machine can't move the layout between them. */
function layout(page: Page) {
  return page.evaluate((mapName) => {
    const box = (el: Element | null | undefined) => {
      const r = el!.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const byLabel = (selector: string, label: string) =>
      [...document.querySelectorAll(selector)].find((el) => el.getAttribute("aria-label")?.startsWith(label));
    const ruszamy = [...document.querySelectorAll("main button")].find((el) => el.textContent?.includes("Ruszamy"));
    return {
      main: box(document.querySelector("main")),
      map: box(byLabel("main [role=region]", mapName)),
      side: box(byLabel("main section", "Odcinki trasy")),
      back: box(byLabel("main a", "Wstecz")),
      go: box(ruszamy),
      pageOverflow: document.documentElement.scrollHeight - window.innerHeight,
    };
  }, MAP.source.slice(1));
}

test("at 1024–1920 px the steps are in a side panel, the map fills the rest of the window, and only the panel scrolls", async ({
  page,
}) => {
  // GIVEN the route screen in a desktop window
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/trasa");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
  const panel = page.getByRole("region", { name: "Odcinki trasy" });
  await expect(panel.getByRole("list", { name: /tekstowa wersja mapy/ })).toBeAttached();
  await expect(page.getByRole("region", { name: MAP })).toBeVisible();

  for (const width of WIDTHS) {
    // WHEN the window is ${width} px wide
    await page.setViewportSize({ width, height: 900 });

    // THEN the panel with the step list is on the left, the map takes the right column from header to window bottom,
    // and "Wstecz" and "Ruszamy" sit in the panel's column, not over the map
    await expect(async () => {
      const { main, map, side, back, go, pageOverflow } = await layout(page);
      expect(side.left).toBeLessThanOrEqual(1);
      expect(side.right).toBeLessThanOrEqual(map.left + 1);
      expect(map.right).toBeGreaterThanOrEqual(width - 1);
      expect(map.top).toBeLessThanOrEqual(main.top + 1);
      expect(map.bottom).toBeGreaterThanOrEqual(main.bottom - 1);
      expect(side.bottom).toBeGreaterThanOrEqual(main.bottom - 1);
      expect(pageOverflow).toBeLessThanOrEqual(1);
      expect(back.right).toBeLessThanOrEqual(map.left);
      expect(go.right).toBeLessThanOrEqual(map.left);
    }, `layout at ${width}px`).toPass({ timeout: 5000 });
  }

  // WHEN the step list, longer than the panel, is scrolled to its end
  const scroller = panel.getByRole("group", { name: "Odcinki trasy" });
  const before = await layout(page);
  expect(await scroller.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
  await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));

  // THEN the panel scrolled, the page and the map did not move, and the mobile sheet toggle isn't offered
  expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect((await layout(page)).map).toEqual(before.map);
  await expect(page.getByRole("button", { name: /arkusz/ })).toBeHidden();
});

test("the desktop route screen passes axe and keeps its structure", async ({ page, expectAccessible, evidence }) => {
  // GIVEN the route screen at 1440 px
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/trasa");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);

  // THEN its structure matches the snapshot and axe finds no WCAG 2.2 A/AA violation
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "route-desktop.aria.yml" });
  await expectAccessible();
  await evidence("route-desktop");
});

test("a keyboard user goes from the form through the results and steps to the map, and Ruszamy guides in the panel", async ({
  page,
  evidence,
}) => {
  // GIVEN the route screen at 1440 px
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/trasa");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);

  // WHEN a keyboard user tabs on from the swap button
  const swap = page.getByRole("button", { name: "Zamień start i cel" });
  const steps = page.locator('button[aria-controls^="odcinek-"]');
  const firstStep = steps.first();
  const zoom = page.getByRole("button", { name: "Przybliż" });
  await swap.focus();
  const reached: string[] = [];
  for (let i = 0; i < 200 && !reached.includes("zoom"); i++) {
    await page.keyboard.press("Tab");
    const hit = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      if (el.closest('[role="group"][aria-label="Rodzaj trasy"]')) return "kind";
      if (el.closest("main") && (el as HTMLInputElement).type === "radio") return "profile";
      if (el.matches('button[aria-controls^="odcinek-"]')) return "step";
      if (el.matches('button[aria-label="Przybliż"]')) return "zoom";
      return null;
    });
    if (hit && !reached.includes(hit)) {
      reached.push(hit);
      if (hit === "step") {
        await expect(firstStep).toBeFocused();
        // Tabbing through all 33 steps only repeats the same stop; carry on from the last one.
        await steps.last().focus();
      }
      if (hit === "zoom") await expect(zoom).toBeFocused();
    }
  }

  // THEN focus walks the form, the results, the step list and only then the map controls
  expect(reached).toEqual(["kind", "profile", "step", "zoom"]);

  // WHEN the visitor opens a step with the keyboard
  const step = page.getByRole("button", { name: /^Odcinek 2 z 33\./ });
  await step.focus();
  await page.keyboard.press("Enter");

  // THEN its details open in the panel
  await expect(step).toHaveAttribute("aria-expanded", "true");

  // WHEN they press "Ruszamy"
  const go = page.getByRole("button", { name: "Ruszamy" });
  await go.focus();
  await page.keyboard.press("Enter");

  // THEN guidance opens in the side panel, left of the map, with focus on its heading
  const guidance = page.getByRole("heading", { level: 1, name: "Prowadzenie" });
  await expect(guidance).toBeFocused();
  await expect(page.locator("main")).toContainText("Krok 1 z 33");
  expect((await guidance.boundingBox())!.x).toBeLessThan((await page.getByRole("region", { name: MAP }).boundingBox())!.x);
  await evidence("route-guidance-desktop");
});

test("at 200% and 400% zoom of a 1440 px window the content scrolls in one direction only", async ({ page }) => {
  // GIVEN a 1440×900 window zoomed to 200%: the page lays out in 720 CSS px
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto("/trasa");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);

  for (const width of [720, 360]) {
    // WHEN zoomed to 200% (720 CSS px) and then 400% (360 CSS px)
    await page.setViewportSize({ width, height: width / 1.6 });

    // THEN nothing overflows sideways
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), { message: `overflow at ${width}px` })
      .toBeLessThanOrEqual(0);
  }
});

test("in English the side panel keeps the same layout", async ({ page, context, baseURL }) => {
  // GIVEN the English UI at 1440 px
  await context.addCookies([{ name: "kbb-lang", value: "en", url: baseURL! }]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/trasa");

  // THEN the steps are in the side panel left of the map
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);
  const panel = page.getByRole("region", { name: "Route segments" });
  const map = (await page.getByRole("region", { name: /^Route map/ }).boundingBox())!;
  const side = (await panel.boundingBox())!;
  expect(side.x + side.width).toBeLessThanOrEqual(map.x + 1);
});

test("the map stays one window tall however long the step list is, with zoom and attribution in view", async ({ page }) => {
  // GIVEN a 1440×900 window and a route of 33 steps, far taller than the window
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/trasa");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/19 min/);

  for (const kind of ["Najkrótsza", "Unikaj schodów"]) {
    // WHEN the route kind is picked
    await page.getByRole("group", { name: "Rodzaj trasy" }).getByRole("button", { name: kind }).click();

    // THEN the map ends at the window's bottom edge, so its zoom buttons and the OSM attribution are on screen
    await expect
      .poll(() => page.evaluate(() => document.querySelector(".maplibregl-map")!.getBoundingClientRect().bottom), { message: kind })
      .toBeLessThanOrEqual(900);
    await expect(page.getByRole("button", { name: "Przybliż" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Informacje o źródłach mapy" })).toBeInViewport();
  }
});
