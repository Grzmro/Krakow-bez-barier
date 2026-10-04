import { describe, expect, it } from "vitest";
import { fitPadding, insidePadding, mapPadding, paddedCentre, panelInset, routeFitPadding } from "./map-padding";

describe("panelInset", () => {
  it("is the panel's height while it is at most half height, stowed included", () => {
    // GIVEN a panel stowed to a 72.4 px bar, and one at its 430 px half height
    // WHEN the covered part of the map is computed
    // THEN it is the panel's own height, in whole px
    expect(panelInset(72.4, 430)).toBe(72);
    expect(panelInset(430, 430)).toBe(430);
  });

  it("stops at half height when the panel is expanded, and is zero beside the map", () => {
    // GIVEN an expanded 760 px panel over a phone map, and a desktop side panel (no half height)
    // WHEN the covered part is computed
    // THEN the phone map keeps the half-height padding and the desktop map none
    expect(panelInset(760, 430)).toBe(430);
    expect(panelInset(760, 0)).toBe(0);
  });
});

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

describe("mapPadding", () => {
  it("adds the panel to the bottom and keeps the overlays when the map above it is tall enough", () => {
    // GIVEN an 800 px map whose bottom 400 px are covered by the list panel
    // WHEN its padding is computed for 150 px of overlays on top and 64 px above the panel
    const padding = mapPadding({ top: 150, bottom: 64 }, 400, 800);

    // THEN the panel is padded out as a whole, the overlays as they are
    expect(padding).toEqual({ top: 150, bottom: 464, left: 0, right: 0 });
  });

  it("fits the overlays into the part above a tall panel", () => {
    // GIVEN an 800 px map with only 300 px left above the panel
    // WHEN the padding is computed
    const padding = mapPadding({ top: 150, bottom: 64 }, 500, 800);

    // THEN the overlays take 60% of those 300 px, in the same proportion
    expect(padding).toEqual({ top: 126, bottom: 554, left: 0, right: 0 });
  });

  it("never pads more than the map's height for the panel", () => {
    // GIVEN a panel taller than the map
    // WHEN the padding is computed
    const padding = mapPadding({ top: 0, bottom: 0 }, 900, 800);

    // THEN the panel's part is capped at the height
    expect(padding.bottom).toBe(800);
  });
});

describe("insidePadding", () => {
  const padding = { top: 100, bottom: 300, left: 0, right: 0 };

  it("is true between the overlays and false under the panel or off the map", () => {
    // GIVEN a 400 × 800 map with 100 px of overlays on top and a 300 px panel at the bottom
    // WHEN points are tested
    // THEN only those in between count as visible
    expect(insidePadding({ x: 200, y: 300 }, 400, 800, padding)).toBe(true);
    expect(insidePadding({ x: 200, y: 600 }, 400, 800, padding)).toBe(false);
    expect(insidePadding({ x: 200, y: 50 }, 400, 800, padding)).toBe(false);
    expect(insidePadding({ x: -10, y: 300 }, 400, 800, padding)).toBe(false);
  });
});

describe("paddedCentre", () => {
  it("is the middle of the area left by the padding", () => {
    // GIVEN a 400 × 800 map padded 100 on top and 300 at the bottom
    // WHEN its centre is computed
    // THEN it sits halfway between the two
    expect(paddedCentre(400, 800, { top: 100, bottom: 300, left: 0, right: 0 })).toEqual([200, 300]);
  });
});

describe("routeFitPadding", () => {
  it("keeps the whole card height on top and trims the bottom margin on a short strip", () => {
    // GIVEN a 600 px phone map, a 190 px card on top and a 288 px panel with a 64 px margin above it
    // WHEN the route's fit padding is computed
    const padding = routeFitPadding({ top: 190, bottom: 64 }, 288, 600);

    // THEN the top is the full card and only the 26 px that leave a 96 px route remain as margin
    expect(padding).toEqual({ top: 190, bottom: 314, left: 0, right: 0 });
  });

  it("never scales the top below the card, even when the strip is shorter than card plus route", () => {
    // GIVEN a strip of only 250 px above the panel
    // WHEN the padding is computed
    const padding = routeFitPadding({ top: 190, bottom: 64 }, 350, 600);

    // THEN the top stays 190 and nothing is added beyond the panel
    expect(padding).toEqual({ top: 190, bottom: 350, left: 0, right: 0 });
  });

  it("keeps the overlays as given on a map with no panel over it", () => {
    // GIVEN a desktop map beside its panel
    // WHEN the padding is computed
    const padding = routeFitPadding({ top: 48, bottom: 96 }, 0, 800);

    // THEN top and bottom are unchanged
    expect(padding).toEqual({ top: 48, bottom: 96, left: 0, right: 0 });
  });
});
