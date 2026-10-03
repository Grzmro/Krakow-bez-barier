import { describe, expect, it } from "vitest";
import type { Route } from "@krakow-bez-barier/contracts";
import { listSavedRoutes, savedRouteRecord, saveRoute, sortSaved, type SavedRouteInput } from "./saved-routes";

const input = (kind: Route["kind"]): SavedRouteInput => ({
  plannedAt: "2026-10-04T07:59:00.000Z",
  from: [19.94798, 50.06714],
  to: [19.93725, 50.06165],
  startName: "Dworzec Główny",
  endName: "Rynek Główny",
  route: { kind } as Route,
  start: null,
  destination: null,
});

describe("savedRouteRecord", () => {
  it("gives the same ends and kind the same id, so saving again replaces the copy", () => {
    // GIVEN the same route saved twice, a minute apart
    const first = savedRouteRecord(input("avoid_stairs"), new Date("2026-10-04T08:00:00Z"));
    const second = savedRouteRecord(input("avoid_stairs"), new Date("2026-10-04T08:01:00Z"));

    // WHEN another kind between the same ends is saved
    const shortest = savedRouteRecord(input("shortest"), new Date("2026-10-04T08:02:00Z"));

    // THEN the copies of one route share an id and keep the date of the last save; the other kind is separate
    expect(second.id).toBe(first.id);
    expect(second.savedAt).toBe("2026-10-04T08:01:00.000Z");
    expect(shortest.id).not.toBe(first.id);
  });
});

describe("sortSaved", () => {
  it("lists the newest route first", () => {
    // GIVEN two routes saved at different times
    const older = savedRouteRecord(input("shortest"), new Date("2026-10-03T08:00:00Z"));
    const newer = savedRouteRecord(input("avoid_stairs"), new Date("2026-10-04T08:00:00Z"));

    // WHEN they are sorted
    const sorted = sortSaved([older, newer]);

    // THEN the newer one comes first
    expect(sorted.map((r) => r.id)).toEqual([newer.id, older.id]);
  });
});

describe("storage without IndexedDB", () => {
  it("says the routes can't be stored instead of throwing", async () => {
    // GIVEN a runtime without IndexedDB (Node here; a browser with storage blocked behaves the same)
    // WHEN the routes are listed and one is saved
    const list = await listSavedRoutes();
    const saved = await saveRoute(input("avoid_stairs"));

    // THEN both report that nothing could be stored
    expect(list).toBeNull();
    expect(saved).toBeNull();
  });
});
