import { describe, expect, it } from "vitest";
import type { Bbox } from "./map-points";
import { searchArea } from "./nearby";
import { CITY_AREA, NEAR_SCOPE, sameScope, scopeArea, viewLeavesArea, viewScope, widerScope } from "./search-scope";

const nearby = { position: { latitude: 50.0614, longitude: 19.9373 } };

describe("scopeArea", () => {
  it("keeps the start area for the near scope", () => {
    // GIVEN a position and the start scope
    // WHEN the area is built
    // THEN it is the usual ~2 km search area
    expect(scopeArea(nearby, NEAR_SCOPE)).toEqual(searchArea(nearby.position));
  });

  it("widens around the same snapped centre and never drops the near area", () => {
    // GIVEN the same position
    // WHEN the wide scope is built
    const near = scopeArea(nearby, NEAR_SCOPE);
    const wide = scopeArea(nearby, { kind: "wide" });

    // THEN it holds the near area and is centred on the same cell
    expect(wide[0]).toBeLessThan(near[0]);
    expect(wide[2]).toBeGreaterThan(near[2]);
    expect((wide[0] + wide[2]) / 2).toBeCloseTo((near[0] + near[2]) / 2, 2);
    expect((wide[1] + wide[3]) / 2).toBeCloseTo((near[1] + near[3]) / 2, 2);
  });

  it("uses the whole city for the city scope", () => {
    // GIVEN the city scope
    // WHEN the area is built
    // THEN it is the city box
    expect(scopeArea(nearby, { kind: "city" })).toEqual(CITY_AREA);
  });

  it("uses the rounded map view for the view scope", () => {
    // GIVEN a view with long decimals
    const scope = viewScope([19.91234567, 50.01234567, 19.99999999, 50.09999999]);

    // WHEN the area is built
    // THEN it is the view rounded to four decimals
    expect(scopeArea(nearby, scope)).toEqual([19.9123, 50.0123, 20, 50.1]);
  });
});

describe("viewLeavesArea", () => {
  const area: Bbox = [19.9, 50.0, 20.0, 50.1];

  it("is false while the view stays inside the area", () => {
    // GIVEN a view inside the area
    // THEN no button is due
    expect(viewLeavesArea(area, [19.92, 50.02, 19.98, 50.08])).toBe(false);
  });

  it("is true once the view is panned or zoomed out past an edge", () => {
    // GIVEN views that reach outside
    // THEN the button is due
    expect(viewLeavesArea(area, [19.95, 50.02, 20.05, 50.08])).toBe(true);
    expect(viewLeavesArea(area, [19.8, 49.9, 20.2, 50.2])).toBe(true);
  });

  it("is false without an area or before the map reports a view", () => {
    // GIVEN no fixed area (whole map) or no view yet
    // THEN there is nothing to search again
    expect(viewLeavesArea(undefined, [19.8, 49.9, 20.2, 50.2])).toBe(false);
    expect(viewLeavesArea(area, null)).toBe(false);
  });

  it("is false right after searching the view, true after the next pan", () => {
    // GIVEN the view was just searched
    const view: Bbox = [19.8, 49.9, 20.2, 50.2];
    const searched = scopeArea(nearby, viewScope(view));

    // THEN it holds that view; a pan past its edge brings the button back
    expect(viewLeavesArea(searched, view)).toBe(false);
    expect(viewLeavesArea(searched, [19.9, 49.9, 20.3, 50.2])).toBe(true);
  });
});

describe("widerScope", () => {
  it("steps from 2 km to 5 km to the whole city, then stops", () => {
    // GIVEN the start scope
    // WHEN asking for wider ones in turn
    const wide = widerScope(NEAR_SCOPE);
    const city = wide && widerScope(wide);

    // THEN 5 km comes, then the city, then nothing
    expect(wide).toEqual({ kind: "wide" });
    expect(city).toEqual({ kind: "city" });
    expect(city && widerScope(city)).toBeNull();
  });

  it("offers nothing after a searched view", () => {
    // GIVEN a user-searched view
    // THEN there is no fixed next step
    expect(widerScope(viewScope([19.9, 50, 20, 50.1]))).toBeNull();
  });
});

describe("sameScope", () => {
  it("compares views by their box", () => {
    // GIVEN two scopes of the same box and one of another
    // THEN only the equal ones match
    expect(sameScope(viewScope([1, 2, 3, 4]), viewScope([1, 2, 3, 4]))).toBe(true);
    expect(sameScope(viewScope([1, 2, 3, 4]), viewScope([1, 2, 3, 5]))).toBe(false);
    expect(sameScope(NEAR_SCOPE, { kind: "wide" })).toBe(false);
  });
});
