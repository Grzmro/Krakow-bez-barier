import { describe, expect, it } from "vitest";
import { createFakePlaceRepository, placeRecord } from "./fake-repository";
import { InvalidQueryError, listPlaces } from "./service";

const NEAR: [number, number] = [19.9403, 50.0507];

// A 40 x 30 grid (1200 places) around the point, 0.001° apart, named so that name order is unrelated to distance.
const grid = Array.from({ length: 1200 }, (_, i) =>
  placeRecord({
    name: `Miejsce ${String(1199 - i).padStart(4, "0")}`,
    location: { x: 19.92 + (i % 40) * 0.001, y: 50.035 + Math.floor(i / 40) * 0.001 },
  }),
);
const repository = createFakePlaceRepository(grid, []);
const deps = { repository, now: new Date("2026-10-03T00:00:00Z") };
const distance = ([x, y]: number[]) => Math.hypot((x - NEAR[0]) * Math.cos((NEAR[1] * Math.PI) / 180), y - NEAR[1]);
const forged = (parts: unknown[]) => Buffer.from(JSON.stringify(parts)).toString("base64url");

describe("listPlaces with near", () => {
  it("puts the nearest places first when the area holds more than a thousand", async () => {
    // GIVEN 1200 places in the area, in name order unrelated to distance
    // WHEN the first page of 25 is read near the point
    const page = await listPlaces({ near: NEAR, limit: 25 }, deps);

    // THEN it holds exactly the 25 nearest places, nearest first
    const expected = [...grid].sort((a, b) => distance([a.location.x, a.location.y]) - distance([b.location.x, b.location.y])).slice(0, 25);
    expect(page.items.map((p) => p.id).sort()).toEqual(expected.map((p) => p.id).sort());
    const dists = page.items.map((item) => distance(item.location.coordinates));
    expect(dists).toEqual([...dists].sort((a, b) => a - b));
    expect(page.total).toBe(1200);
  });

  it("pages through the whole list without gaps or repeats, ties broken by id", async () => {
    // GIVEN places at identical distances (A and C coincide) and a page size that splits them
    const tied = [
      placeRecord({ name: "A", location: { x: 19.941, y: 50.05 } }),
      placeRecord({ name: "B", location: { x: 19.939, y: 50.05 } }),
      placeRecord({ name: "C", location: { x: 19.941, y: 50.05 } }),
      placeRecord({ name: "D", location: { x: 19.9, y: 50.0 } }),
    ];
    const tiedDeps = { ...deps, repository: createFakePlaceRepository(tied, []) };

    // WHEN paging by one
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await listPlaces({ near: NEAR, limit: 1, cursor }, tiedDeps);
      seen.push(...page.items.map((p) => p.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    // THEN the coinciding A and C come first in id order, then B, then the far D
    const [a, b, c, d] = tied.map((p) => p.id);
    expect(seen).toEqual([...[a, c].sort(), b, d]);
  });

  it("keeps the name order and its cursors without near", async () => {
    // GIVEN the same places
    // WHEN paging by name
    const first = await listPlaces({ limit: 2 }, deps);
    const second = await listPlaces({ limit: 2, cursor: first.nextCursor! }, deps);

    // THEN the names ascend across pages
    expect(first.items.map((p) => p.name)).toEqual(["Miejsce 0000", "Miejsce 0001"]);
    expect(second.items.map((p) => p.name)).toEqual(["Miejsce 0002", "Miejsce 0003"]);
  });

  it("refuses a cursor of the other order, of another point or malformed", async () => {
    // GIVEN a name cursor and a near cursor
    const byName = (await listPlaces({ limit: 1 }, deps)).nextCursor!;
    const byNear = (await listPlaces({ near: NEAR, limit: 1 }, deps)).nextCursor!;

    // WHEN each is used where it doesn't belong
    const attempts = [
      listPlaces({ near: NEAR, cursor: byName }, deps),
      listPlaces({ cursor: byNear }, deps),
      listPlaces({ near: [19.95, 50.05], cursor: byNear }, deps),
      listPlaces({ near: NEAR, cursor: forged(["near", ...NEAR, -1, "x"]) }, deps),
      listPlaces({ near: NEAR, cursor: forged(["near", ...NEAR, "1", "x"]) }, deps),
    ];

    // THEN every one is an invalid cursor
    for (const attempt of attempts) {
      await expect(attempt).rejects.toBeInstanceOf(InvalidQueryError);
      await expect(attempt).rejects.toMatchObject({ field: "query.cursor" });
    }
  });

  it("refuses a point outside WGS84", async () => {
    // GIVEN a latitude of 120 WHEN listing THEN it is a query error on near
    await expect(listPlaces({ near: [19.9, 120] }, deps)).rejects.toMatchObject({ field: "query.near" });
  });

  it("leaves hidden-by-default categories out near me too, unless named", async () => {
    // GIVEN a parking space next to the point and a museum farther away
    const parking = placeRecord({ name: "Parking", category: "parking", location: { x: 19.94, y: 50.05 } });
    const museum = placeRecord({ name: "Muzeum", location: { x: 19.95, y: 50.05 } });
    const local = { ...deps, repository: createFakePlaceRepository([parking, museum], []) };

    // WHEN listing near the point, with and without naming the category
    const plain = await listPlaces({ near: NEAR }, local);
    const named = await listPlaces({ near: NEAR, category: ["parking"] }, local);

    // THEN the parking space shows only when named
    expect(plain.items.map((p) => p.name)).toEqual(["Muzeum"]);
    expect(named.items.map((p) => p.name)).toEqual(["Parking"]);
  });
});
