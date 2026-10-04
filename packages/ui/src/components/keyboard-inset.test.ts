import { describe, expect, it } from "vitest";
import { keyboardInset } from "./keyboard-inset";

describe("keyboardInset", () => {
  it("is the height the keyboard takes from the unzoomed viewport", () => {
    // GIVEN an iPhone viewport with the keyboard open
    // WHEN the inset is computed
    const inset = keyboardInset({ innerHeight: 844, height: 508.4, scale: 1 });
    // THEN the sheet moves up by the keyboard height
    expect(inset).toBe(336);
  });

  it("is zero without a keyboard", () => {
    // GIVEN the visual viewport as tall as the layout viewport
    // WHEN / THEN nothing covers the sheet
    expect(keyboardInset({ innerHeight: 844, height: 844, scale: 1 })).toBe(0);
  });

  it("ignores a pinch-zoom, which shrinks the visual viewport without covering anything", () => {
    // GIVEN the page zoomed to 2x with a text field focused
    // WHEN the inset is computed
    const inset = keyboardInset({ innerHeight: 839, height: 419.5, scale: 2 });
    // THEN there is no answer, so the sheet keeps its place and size
    expect(inset).toBeNull();
  });
});
