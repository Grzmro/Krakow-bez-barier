import { describe, expect, it } from "vitest";
import { byDistance, searchArea, searchCentre, toLonLat } from "./nearby";

const WAWEL = { latitude: 50.0541, longitude: 19.9354 };

describe("searchArea", () => {
  it("snaps the position to a 0.01° grid and spans about 2 km around it", () => {
    // GIVEN a device at Wawel
    // WHEN the search area is computed
    const area = searchArea(WAWEL);

    // THEN it is centred on the grid cell, not on the device
    expect(area).toEqual([19.91, 50.03, 19.97, 50.07]);
  });

  it("gives the same area for two positions in the same cell", () => {
    // GIVEN two positions a few hundred metres apart in one grid cell
    const a = { latitude: 50.0541, longitude: 19.9354 };
    const b = { latitude: 50.0512, longitude: 19.9389 };

    // WHEN their areas are computed
    // THEN the server cannot tell them apart
    expect(searchArea(a)).toEqual(searchArea(b));
  });
});

describe("searchCentre", () => {
  it("is the middle of the search area, never the device position", () => {
    // GIVEN a device at Wawel
    // WHEN the point the API orders from is computed
    const centre = searchCentre(WAWEL);

    // THEN it is the snapped grid point
    expect(centre).toEqual([19.94, 50.05]);
  });
});

describe("byDistance", () => {
  it("orders places nearest first with distances from the origin", () => {
    // GIVEN two places, the farther one listed first
    const far = { id: "rynek", location: { coordinates: [19.9373, 50.0614] } };
    const near = { id: "wawel", location: { coordinates: [19.9355, 50.0543] } };

    // WHEN they are ordered from Wawel
    const result = byDistance([far, near], toLonLat(WAWEL));

    // THEN the nearest comes first and each distance is in metres
    expect(result.map(({ place }) => place.id)).toEqual(["wawel", "rynek"]);
    expect(result[0].distance).toBe(20);
    expect(result[1].distance).toBeGreaterThan(700);
  });
});
