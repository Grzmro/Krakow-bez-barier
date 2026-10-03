import { expect, test } from "./fixtures";

const CASES = [
  { width: 390, height: 844, locale: "pl" },
  { width: 1024, height: 768, locale: "pl" },
  { width: 1440, height: 900, locale: "pl" },
  { width: 1024, height: 768, locale: "en" },
];

for (const { width, height, locale } of CASES) {
  test(`at ${width}px (${locale}) chips keep one size per group and never widen the page`, async ({ page, context, baseURL }) => {
    // GIVEN the home screen in a window of this width and language
    await context.addCookies([{ name: "kbb-lang", value: locale, url: baseURL! }]);
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const groups = [page.getByRole("group", { name: /Kategorie|Categories/ }), page.getByRole("group", { name: /Filtry cech|Feature filters/ })];
    for (const group of groups) await expect(group.getByRole("button").first()).toBeVisible();

    for (const group of groups) {
      // WHEN measuring the chips of a group
      const boxes = await group.getByRole("button").evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { w: r.width, h: r.height, right: r.right };
        }),
      );

      // THEN they are all the same height and at least 24 px (2.5.8), none is stretched past its text,
      // and on a desktop panel none sticks out of it
      expect(new Set(boxes.map((b) => Math.round(b.h))).size).toBe(1);
      expect(boxes[0].h).toBeGreaterThanOrEqual(24);
      expect(Math.max(...boxes.map((b) => b.w))).toBeLessThan(220);
      if (width >= 1024) {
        const panel = (await page.getByRole("region", { name: /Lista miejsc|List of places/ }).boundingBox())!;
        expect(Math.max(...boxes.map((b) => b.right))).toBeLessThanOrEqual(panel.x + panel.width);
      }
    }

    // AND the page itself does not scroll sideways
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}
