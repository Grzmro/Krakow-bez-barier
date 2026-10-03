import { expect, test } from "./fixtures";

for (const { width, locale } of [
  { width: 360, locale: "pl" },
  { width: 390, locale: "pl" },
  { width: 360, locale: "en" },
]) {
  test(`at ${width}px (${locale}) the four profiles share one row and no name is cut`, async ({ page, context, baseURL }) => {
    // GIVEN the home screen on a narrow phone
    await context.addCookies([{ name: "kbb-lang", value: locale, url: baseURL! }]);
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const group = page.getByRole("group", { name: /Profil potrzeb|Needs profile/ });
    await expect(group.getByRole("radio")).toHaveCount(4);

    // WHEN measuring the segments
    const segments = await group.locator("label").evaluateAll((els) =>
      els.map((el) => {
        const text = el.querySelector("span")!;
        return { top: Math.round(el.getBoundingClientRect().top), cut: text.scrollWidth > text.clientWidth + 1 };
      }),
    );

    // THEN they are on one row and every name is fully visible
    expect(new Set(segments.map((s) => s.top)).size).toBe(1);
    expect(segments.some((s) => s.cut)).toBe(false);
  });
}
