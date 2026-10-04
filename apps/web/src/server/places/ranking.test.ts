import { describe, expect, it } from "vitest";
import { createFakePlaceRepository, placeRecord } from "./fake-repository";
import { listPlaces } from "./service";

const RYNEK: [number, number] = [19.9373, 50.0617];

// The places the real data returns for "Wawel" (OSM names and categories), closer to Rynek first.
const wawel = [
  placeRecord({ name: "Hotel Wawel", category: "hotel", location: { x: 19.9393, y: 50.0583 } }),
  placeRecord({ name: "Pod Wawelem", category: "restaurant", location: { x: 19.9393, y: 50.0546 } }),
  placeRecord({ name: "Hotel Wawel Queen", category: "hotel", location: { x: 19.9339, y: 50.0568 } }),
  placeRecord({ name: "Zamek Królewski na Wawelu", category: "other", location: { x: 19.9366, y: 50.0544 } }),
  placeRecord({ name: "Wawel Zaginiony", category: "museum", location: { x: 19.9363, y: 50.0541 } }),
  placeRecord({ name: "Bistro Wawelska", category: "restaurant", location: { x: 20.0002, y: 50.0985 } }),
  placeRecord({ name: "Podwawelska", category: "pharmacy", location: { x: 19.9321, y: 50.0429 } }),
];
const deps = { repository: createFakePlaceRepository(wawel, []), now: new Date("2026-10-03T00:00:00Z") };

describe("listPlaces with a text query", () => {
  it("lists landmarks before hotels that share the word, nearest first within a rank", async () => {
    // GIVEN places named with "Wawel", hotels nearer to Rynek than the castle
    // WHEN a visitor searches "Wawel" near Rynek
    const page = await listPlaces({ q: "Wawel", near: RYNEK }, deps);

    // THEN the castle and the museum come first, then the hotels, then word starts, then a match inside a word
    expect(page.items.map((p) => p.name)).toEqual([
      "Zamek Królewski na Wawelu",
      "Wawel Zaginiony",
      "Hotel Wawel",
      "Hotel Wawel Queen",
      "Pod Wawelem",
      "Bistro Wawelska",
      "Podwawelska",
    ]);
  });

  it("ranks by the name before the alphabet without near", async () => {
    // GIVEN the same places
    // WHEN searching without a point
    const page = await listPlaces({ q: "wawel" }, deps);

    // THEN the landmarks still come first, in name order
    expect(page.items.slice(0, 2).map((p) => p.name)).toEqual(["Wawel Zaginiony", "Zamek Królewski na Wawelu"]);
  });

  it("pages through the ranked list without gaps or repeats", async () => {
    // GIVEN the ranked list read in one go
    const all = (await listPlaces({ q: "Wawel", near: RYNEK }, deps)).items.map((p) => p.id);

    // WHEN it is read two at a time, in either order
    for (const near of [RYNEK, undefined]) {
      const whole = near ? all : (await listPlaces({ q: "Wawel" }, deps)).items.map((p) => p.id);
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await listPlaces({ q: "Wawel", near, limit: 2, cursor }, deps);
        seen.push(...page.items.map((p) => p.id));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);

      // THEN the pages join up into the same order
      expect(seen).toEqual(whole);
    }
  });

  it("refuses a cursor with a rank out of range", async () => {
    // GIVEN a forged name cursor with a rank no search gives
    const forged = Buffer.from(JSON.stringify(["Hotel Wawel", "x", 99])).toString("base64url");

    // WHEN it is used
    // THEN it is an invalid cursor
    await expect(listPlaces({ q: "Wawel", cursor: forged }, deps)).rejects.toMatchObject({ field: "query.cursor" });
  });
});
