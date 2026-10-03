import { expect, test } from "./fixtures";

// The home screen as a laptop or monitor shows it (the desktop project).

const WIDTHS = [1024, 1440, 1920];

for (const width of WIDTHS) {
  test(`at ${width}px the list is a side panel and the map fills the rest of the window`, async ({ page }) => {
    // GIVEN the home screen in a desktop window
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const panel = page.getByRole("region", { name: "Lista miejsc" });
    await expect(panel.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
    const canvas = page.locator(".maplibregl-canvas");
    await expect(canvas).toBeVisible();

    // THEN the panel is on the left, the map takes the right column from header to window bottom, no empty strip
    const main = (await page.locator("main").boundingBox())!;
    const map = (await canvas.boundingBox())!;
    const side = (await panel.boundingBox())!;
    expect(side.x + side.width).toBeLessThanOrEqual(map.x + 1);
    expect(map.x + map.width).toBeGreaterThanOrEqual(width - 1);
    expect(map.y).toBeLessThanOrEqual(main.y + 1);
    expect(map.y + map.height).toBeGreaterThanOrEqual(main.y + main.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(1);

    // AND no category or filter chip is cut off by the panel's edge
    for (const group of ["Kategorie", "Filtry cech"]) {
      const chips = page.getByRole("group", { name: group }).getByRole("button");
      for (let i = 0; i < (await chips.count()); i++) {
        const box = (await chips.nth(i).boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(side.x + side.width);
      }
    }
  });
}

test("the list scrolls inside its panel while the page and the map stay put, and the sheet grabber is gone", async ({
  page,
  expectAccessible,
  evidence,
}) => {
  // GIVEN the home screen at 1440 px, first as a full desktop window for the evidence
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Lista miejsc" });
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home-desktop.aria.yml" });
  await expectAccessible();
  await evidence("home-desktop");

  // AND then in a short window, so the list certainly overflows its panel
  await page.setViewportSize({ width: 1440, height: 600 });
  const scroller = panel.getByRole("group", { name: "Lista miejsc" });
  const canvas = page.locator(".maplibregl-canvas");
  // MapLibre resizes its canvas on the next frame after the window shrinks.
  await expect.poll(async () => (await canvas.boundingBox())!.height).toBeLessThanOrEqual(600);
  const mapBefore = await canvas.boundingBox();
  expect(await scroller.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);

  // WHEN the list is scrolled to its end
  await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));

  // THEN the panel scrolled, the page and the map did not move, and the mobile sheet toggle isn't offered
  expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await canvas.boundingBox()).toEqual(mapBefore);
  await expect(page.getByRole("button", { name: /arkusz/ })).toBeHidden();
});

test("on a short window the search and chips leave the list at least a third of the height", async ({ page }) => {
  // GIVEN the home screen in a 1024×600 window (a laptop at 125% zoom)
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Lista miejsc" });
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("9 miejsc");

  // WHEN measuring the list panel
  const box = (await panel.boundingBox())!;

  // THEN it keeps room for the list: the chips scroll in their own block instead of squeezing it out
  expect(box.height).toBeGreaterThanOrEqual(200);
});

test("the skip link jumps to the list on desktop", async ({ page }) => {
  // GIVEN the home screen at 1440 px
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Lista miejsc" }).getByRole("heading", { level: 2 })).toHaveText("9 miejsc");

  // WHEN the visitor tabs to "Przejdź do listy" (the second skip link after the page-wide one) and activates it
  const link = page.getByRole("link", { name: "Przejdź do listy" });
  await link.focus();
  await expect(link).toBeVisible();
  await page.keyboard.press("Enter");

  // THEN focus lands on the list
  await expect(page.locator("#lista")).toBeFocused();
});

test("the document order, which tab order follows, is search, categories, filters, list, then the map", async ({ page }) => {
  // GIVEN the home screen at 1440 px
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Lista miejsc" }).getByRole("heading", { level: 2 })).toHaveText("9 miejsc");

  // WHEN comparing where these controls sit in the document
  const order = await page.evaluate(() => {
    const index = (el: Element | null) => (el ? [...document.querySelectorAll("*")].indexOf(el) : -1);
    return {
      search: index(document.querySelector('[role="combobox"]')),
      categories: index(document.querySelector('[role="group"][aria-label="Kategorie"] button')),
      filters: index(document.querySelector('[role="group"][aria-label="Filtry cech"] button')),
      list: index(document.querySelector('a[href^="/miejsca/"]')),
      zoom: index(document.querySelector('button[aria-label="Przybliż"]')),
    };
  });

  // THEN tab order follows it: search before categories before filters before the list before the map controls
  expect(Object.values(order).every((n) => n >= 0)).toBe(true);
  expect([order.search, order.categories, order.filters, order.list, order.zoom]).toEqual(
    [order.search, order.categories, order.filters, order.list, order.zoom].toSorted((a, b) => a - b),
  );
});
