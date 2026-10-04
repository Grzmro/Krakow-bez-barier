import { describe, expect, it } from "vitest";
import { sheetFit, sheetStyle } from "./keyboard-inset";

/** Top of a sheet sized to the fit, in layout-viewport px (status bar ignored). */
const sheetTop = (innerHeight: number, fit: { bottom: number; visibleHeight: number }) =>
  innerHeight - fit.bottom - fit.visibleHeight;

describe("sheetFit", () => {
  it("lifts the sheet by the keyboard when the web view keeps its size (Safari, WKWebView)", () => {
    // GIVEN an iPhone 390x844 with a 365 px keyboard over a web view that doesn't resize
    // WHEN the fit is computed
    const fit = sheetFit({ innerHeight: 844, height: 479.4, offsetTop: 0, scale: 1 });
    // THEN the sheet sits on the keyboard and is at most as tall as what's left above it
    expect(fit).toEqual({ bottom: 365, visibleHeight: 479 });
  });

  it("doesn't lift the sheet again when the web view itself shrinks for the keyboard", () => {
    // GIVEN a web view resized to the area above the keyboard: innerHeight shrinks with the viewport
    // WHEN the fit is computed
    const fit = sheetFit({ innerHeight: 479, height: 479, offsetTop: 0, scale: 1 });
    // THEN there is no extra offset, so no gap above the keyboard
    expect(fit).toEqual({ bottom: 0, visibleHeight: 479 });
  });

  it("keeps the sheet's top on screen when iOS panned the page to show the focused field", () => {
    // GIVEN the keyboard open and the visual viewport panned down by 120 px
    // WHEN the fit is computed
    const fit = sheetFit({ innerHeight: 844, height: 479, offsetTop: 120, scale: 1 })!;
    // THEN the sheet's bottom lands on the keyboard, with no gap under it
    expect(fit.bottom).toBe(245);
    // AND a sheet of the full height starts at the top of the visible area, not above it
    expect(sheetTop(844, fit)).toBe(120);
  });

  it("is the whole viewport without a keyboard", () => {
    // GIVEN the visual viewport as tall as the layout viewport
    // WHEN / THEN nothing covers the sheet
    expect(sheetFit({ innerHeight: 844, height: 844, offsetTop: 0, scale: 1 })).toEqual({ bottom: 0, visibleHeight: 844 });
  });

  it("ignores a pinch-zoom, which shrinks the visual viewport without covering anything", () => {
    // GIVEN the page zoomed to 2x with a text field focused
    // WHEN the fit is computed
    const fit = sheetFit({ innerHeight: 839, height: 419.5, offsetTop: 200, scale: 2 });
    // THEN there is no answer, so the sheet keeps its place and size
    expect(fit).toBeNull();
  });
});

describe("sheetStyle", () => {
  it("caps the height below the status bar and drops the home-indicator padding on the keyboard", () => {
    // GIVEN the keyboard open
    // WHEN the style is built
    const style = sheetStyle({ bottom: 365, visibleHeight: 479 });
    // THEN the sheet sits on the keyboard, fits under the safe area and has no bottom padding
    expect(style).toEqual({
      bottom: 365,
      paddingBottom: 0,
      maxHeight: "min(92dvh, calc(479px - env(safe-area-inset-top, 0px) - 0.5rem))",
    });
  });

  it("keeps the class's bottom and padding without a keyboard", () => {
    // GIVEN no keyboard
    // WHEN the style is built
    const style = sheetStyle({ bottom: 0, visibleHeight: 844 });
    // THEN only the height is capped
    expect(style).toEqual({ maxHeight: "min(92dvh, calc(844px - env(safe-area-inset-top, 0px) - 0.5rem))" });
  });

  it("doesn't take a fractional viewport height for a keyboard", () => {
    // GIVEN a visual viewport a fraction of a pixel shorter than innerHeight, rounding to 1 px
    const fit = sheetFit({ innerHeight: 845, height: 844.4, offsetTop: 0, scale: 1 })!;
    // WHEN the style is built
    const style = sheetStyle(fit);
    // THEN the sheet keeps its place and its home-indicator padding
    expect(style).not.toHaveProperty("bottom");
    expect(style).not.toHaveProperty("paddingBottom");
  });

  it("leaves the sheet to its classes before the viewport is measured", () => {
    // GIVEN / WHEN / THEN no fit yet means no inline style
    expect(sheetStyle(null)).toBeUndefined();
  });
});
