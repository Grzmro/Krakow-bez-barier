import { describe, expect, it } from "vitest";
import { fitPadding } from "./map-padding";

describe("fitPadding", () => {
  it("keeps the padding of a map tall enough for it", () => {
    // GIVEN a 700 px map and 250 px of overlays
    // WHEN the padding is fitted
    const padding = fitPadding({ top: 150, bottom: 100 }, 700);

    // THEN it is unchanged
    expect(padding).toEqual({ top: 150, bottom: 100 });
  });

  it("shrinks it proportionally on a short map, leaving 40% of the height to the places", () => {
    // GIVEN a 250 px map, as tall as its overlay padding
    // WHEN the padding is fitted
    const padding = fitPadding({ top: 150, bottom: 100 }, 250);

    // THEN top and bottom take 60% of the height together, in the same proportion
    expect(padding).toEqual({ top: 90, bottom: 60 });
  });

  it("leaves the padding alone before the map has a size", () => {
    // GIVEN a map not laid out yet
    // WHEN the padding is fitted
    // THEN nothing is scaled to zero
    expect(fitPadding({ top: 150, bottom: 100 }, 0)).toEqual({ top: 150, bottom: 100 });
  });
});
