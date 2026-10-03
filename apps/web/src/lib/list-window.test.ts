import { describe, expect, it } from "vitest";
import { LIST_PAGE, nextWindow, windowFor } from "./list-window";

describe("nextWindow", () => {
  it("adds one page of rows", () => {
    // GIVEN 20 of 100 rows rendered
    // WHEN the visitor scrolls to the end or presses "Pokaż więcej"
    const rendered = nextWindow(LIST_PAGE, 100);

    // THEN 40 rows are rendered
    expect(rendered).toBe(40);
  });

  it("stops at the end of the list", () => {
    // GIVEN 100 of 105 rows rendered
    // WHEN one more page is asked for
    // THEN only the 5 left are added
    expect(nextWindow(100, 105)).toBe(105);
  });
});

describe("windowFor", () => {
  it("keeps the window when the row is already rendered", () => {
    // GIVEN 20 rows rendered and a pin of the 6th place tapped
    // WHEN sizing the window for it
    // THEN nothing changes
    expect(windowFor(5, 20)).toBe(20);
  });

  it("grows to the page that holds a row further down", () => {
    // GIVEN 20 rows rendered and a pin of the 87th place tapped
    // WHEN sizing the window for it
    const rendered = windowFor(86, 20);

    // THEN whole pages up to the 87th row are rendered, so it can be scrolled to and selected
    expect(rendered).toBe(100);
    expect(rendered).toBeGreaterThan(86);
  });

  it("keeps the window for a place that is not on the list", () => {
    // GIVEN a place the verdict filter hides (index -1)
    // WHEN sizing the window for it
    // THEN nothing changes
    expect(windowFor(-1, 40)).toBe(40);
  });
});
