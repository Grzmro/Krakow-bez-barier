import { describe, expect, it } from "vitest";
import { listedCount } from "./list-count";

describe("listedCount", () => {
  it("counts the places on the page, not the area's total", () => {
    // GIVEN a page of 100 places out of an area of 4003 and no verdict filter
    const page = { items: Array.from({ length: 100 }, (_, i) => i), total: 4003 };

    // WHEN counting what is shown
    const count = listedCount(page, 100);

    // THEN the heading says 100, matching the list and the map
    expect(count).toBe(100);
  });

  it("counts only the places a verdict filter leaves", () => {
    // GIVEN 100 fetched places of which the filter keeps 12
    const page = { items: Array.from({ length: 100 }, (_, i) => i) };

    // WHEN counting
    // THEN 12
    expect(listedCount(page, 12)).toBe(12);
  });
});
