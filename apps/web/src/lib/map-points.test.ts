import { describe, expect, it } from "vitest";
import type { PlaceSummary } from "@krakow-bez-barier/contracts";
import { containsBbox, nextPointsArea, pointsArea, toPoint, type Bbox } from "./map-points";

const OLD_TOWN: Bbox = [19.9312, 50.0571, 19.9441, 50.0663];

describe("map points area", () => {
  it("loads the view with half a view of margin on each side, snapped outward to the grid", () => {
    // GIVEN / WHEN the Old Town is in view
    const area = pointsArea(OLD_TOWN);

    // THEN the area holds the view with room around it, on whole grid steps
    expect(containsBbox(area, OLD_TOWN)).toBe(true);
    expect(area).toEqual([19.92, 50.05, 19.96, 50.08]);
  });

  it("gives the same area for small pans, so they share one cached request", () => {
    // GIVEN two views a few metres apart
    const nudged: Bbox = [OLD_TOWN[0] + 0.0004, OLD_TOWN[1], OLD_TOWN[2] + 0.0004, OLD_TOWN[3]];

    // WHEN / THEN both snap to the same area
    expect(pointsArea(nudged)).toEqual(pointsArea(OLD_TOWN));
  });

  it("keeps the loaded area while the view stays inside it, and moves on once it leaves", () => {
    // GIVEN the area loaded for the Old Town
    const loaded = pointsArea(OLD_TOWN);

    // WHEN the map zooms in on the Main Square, then pans to Nowa Huta
    const zoomedIn = nextPointsArea(loaded, [19.935, 50.06, 19.94, 50.063]);
    const nowaHuta = nextPointsArea(loaded, [20.02, 50.065, 20.04, 50.08]);

    // THEN zooming in loads nothing new (the same area object), the pan loads Nowa Huta
    expect(zoomedIn).toBe(loaded);
    expect(containsBbox(nowaHuta, [20.02, 50.065, 20.04, 50.08])).toBe(true);
    expect(nowaHuta).not.toEqual(loaded);
  });

  it("starts from the view when nothing is loaded yet, and never leaves WGS84", () => {
    // GIVEN / WHEN the first view, and a view of the whole world
    // THEN the first is padded, the world is clamped
    expect(nextPointsArea(null, OLD_TOWN)).toEqual(pointsArea(OLD_TOWN));
    expect(pointsArea([-180, -85, 180, 85])).toEqual([-180, -90, 180, 90]);
  });

  it("keeps the same area object for a view wider than the world, so the map doesn't re-render for nothing", () => {
    // GIVEN the world loaded
    const world = pointsArea([-200, -85, 200, 85]);

    // WHEN the same over-wide view comes again
    // THEN the loaded area is returned as is
    expect(nextPointsArea(world, [-200, -85, 200, 85])).toBe(world);
  });
});

describe("toPoint", () => {
  it("keeps what a pin needs from a list row, and no verdict stays null", () => {
    // GIVEN a list row with a verdict and one without
    const row = {
      id: "sukiennice",
      name: "Sukiennice",
      category: "museum",
      location: { type: "Point", coordinates: [19.9373, 50.0617] },
      summary: [],
      isSample: true,
    } satisfies PlaceSummary;

    // WHEN / THEN each becomes a point with the verdict's state
    expect(toPoint({ ...row, verdict: { state: "barrier", unconfirmed: false, reasons: [] } })).toEqual({
      id: "sukiennice",
      name: "Sukiennice",
      category: "museum",
      location: row.location,
      verdict: "barrier",
    });
    expect(toPoint(row).verdict).toBeNull();
  });
});
