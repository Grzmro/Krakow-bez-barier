import { categories } from "@krakow-bez-barier/contracts";
import { describe, expect, it } from "vitest";
import { ICON_KEYS } from "./categories";

describe("category icons", () => {
  it("has an icon in the web registry for every configured category", () => {
    // GIVEN the category config WHEN collecting the icon keys it uses
    const used = [...new Set(categories.map((c) => c.icon))];

    // THEN each one is drawable, so a new category never silently falls back to the pin
    expect(used.filter((icon) => !ICON_KEYS.includes(icon))).toEqual([]);
  });
});
