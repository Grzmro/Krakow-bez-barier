import { describe, expect, it } from "vitest";
import { byDistance, collectPages, searchArea, toLonLat } from "./nearby";

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

describe("collectPages", () => {
  const pages = [
    { items: [1, 2], nextCursor: "a", total: 5 },
    { items: [3, 4], nextCursor: "b", total: 5 },
    { items: [5], nextCursor: null, total: 5 },
  ];
  const fetchPage = (cursor: string | undefined) => Promise.resolve(pages[cursor === undefined ? 0 : cursor === "a" ? 1 : 2]);

  it("follows the cursor until the area is exhausted", async () => {
    // GIVEN an area spread over three pages
    // WHEN every page is collected
    const result = await collectPages(fetchPage);

    // THEN all places are there and nothing is left
    expect(result).toEqual({ items: [1, 2, 3, 4, 5], nextCursor: null, total: 5 });
  });

  it("stops at the page cap and keeps the cursor to show the list is cut short", async () => {
    // GIVEN the same area and a cap of two pages
    // WHEN pages are collected
    const result = await collectPages(fetchPage, 2);

    // THEN only two pages are merged and the cursor says more remain
    expect(result).toEqual({ items: [1, 2, 3, 4], nextCursor: "b", total: 5 });
  });
});
