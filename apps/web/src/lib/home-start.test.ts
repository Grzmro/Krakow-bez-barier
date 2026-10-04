import { describe, expect, it } from "vitest";
import { escapeStep, homeView, isSearching, panelAfterAsk, searchOrigin } from "./home-start";

const start = { q: "", category: null, features: [], nearby: null };
const rynek: [number, number] = [19.9372, 50.0617];
const here = { latitude: 50.0647, longitude: 19.945 };

describe("isSearching", () => {
  it("is false at the start: no query, category, feature or location", () => {
    // GIVEN nothing was asked
    // WHEN the state is read
    // THEN there is no list and no pins
    expect(isSearching(start)).toBe(false);
  });

  it("ignores a query of only spaces", () => {
    expect(isSearching({ ...start, q: "   " })).toBe(false);
  });

  it.each([
    ["a query", { q: "kawiarnia" }],
    ["a category", { category: "pharmacy" }],
    ["a feature filter", { features: ["lift"] }],
    ["a location", { nearby: { position: here } }],
  ])("is true with %s", (_, ask) => {
    // GIVEN one thing was asked
    // WHEN the state is read
    // THEN results and pins show
    expect(isSearching({ ...start, ...ask })).toBe(true);
  });

  it("returns to the start when everything is cleared", () => {
    // GIVEN a search that was then cleared
    const searched = { ...start, q: "apteka", category: "pharmacy" };
    expect(isSearching(searched)).toBe(true);
    // WHEN the query and category are reset
    // THEN the start state is back
    expect(isSearching({ ...searched, q: "", category: null })).toBe(false);
  });
});

describe("homeView", () => {
  it("peeks the nearest places on a clean map at the start", () => {
    // GIVEN nothing was asked and there is no position
    // WHEN the view is resolved
    const view = homeView(start, searchOrigin(null, rynek));
    // THEN the panel is a peek, no pins show, and nothing claims to be near the user
    expect(view).toEqual({ searching: false, pins: false, panel: "peek", heading: "nearCentre" });
  });

  it("calls the peek 'near you' only for a device position", () => {
    // GIVEN the device position and a hand-picked point
    // WHEN the headings are resolved
    // THEN only the device position is "near you"
    expect(homeView(start, searchOrigin({ position: here }, rynek)).heading).toBe("nearYou");
    expect(homeView(start, searchOrigin({ position: here, place: "Kazimierz" }, rynek)).heading).toBe("nearChosen");
  });

  it.each([
    ["a query", { q: "kawiarnia" }],
    ["a category", { category: "pharmacy" }],
    ["a quick action's feature", { features: ["toilet_accessible"] }],
    ["the near me toggle", { nearby: { position: here } }],
  ])("shows results and pins after %s", (_, ask) => {
    // GIVEN one thing was asked
    // WHEN the view is resolved
    const view = homeView({ ...start, ...ask }, searchOrigin(null, rynek));
    // THEN the results panel and pins show
    expect(view).toMatchObject({ searching: true, pins: true, panel: "results" });
  });

  it("returns to the peek and a clean map when the search is cleared", () => {
    // GIVEN results for a query
    const origin = searchOrigin(null, rynek);
    expect(homeView({ ...start, q: "apteka" }, origin).pins).toBe(true);
    // WHEN the query is cleared
    const cleared = homeView({ ...start, q: "" }, origin);
    // THEN the start view is back
    expect(cleared).toMatchObject({ pins: false, panel: "peek" });
  });
});

describe("panelAfterAsk", () => {
  const pulledUp = { expanded: true, stowed: true, selectedId: "p1" };

  it("collapses the sheet and drops the selection when the search is cleared", () => {
    // GIVEN results with a place selected and the sheet pulled up
    // WHEN the search is cleared (searching goes true -> false)
    const next = panelAfterAsk(true, false, pulledUp);
    // THEN the start state is back: sheet down, slid out, nothing selected
    expect(next).toEqual({ expanded: false, stowed: false, selectedId: null });
  });

  it("starts the results slid out and unselected when something is asked", () => {
    // GIVEN the peek the user had hidden
    // WHEN a category is picked (false -> true)
    const next = panelAfterAsk(false, true, { ...pulledUp, selectedId: null });
    // THEN the results panel is not hidden
    expect(next).toEqual({ expanded: false, stowed: false, selectedId: null });
  });

  it("keeps the user's own sheet state while the search stays the same", () => {
    // GIVEN a selection inside results
    // WHEN another keystroke leaves searching true
    // THEN nothing is reset
    expect(panelAfterAsk(true, true, pulledUp)).toBe(pulledUp);
  });
});

describe("escapeStep", () => {
  it("drops the selected place first, then collapses the sheet, then does nothing", () => {
    // GIVEN a selected place and a pulled-up sheet
    // WHEN Escape is pressed repeatedly
    // THEN each press undoes one layer
    expect(escapeStep({ expanded: true, selectedId: "p1" })).toBe("deselect");
    expect(escapeStep({ expanded: true, selectedId: null })).toBe("collapse");
    expect(escapeStep({ expanded: false, selectedId: null })).toBeNull();
  });
});

describe("searchOrigin", () => {
  it("uses the device position first", () => {
    // GIVEN the device position
    // WHEN the origin is resolved
    const origin = searchOrigin({ position: here }, rynek);
    // THEN it is centred on the user, with a coarse area
    expect(origin.source).toBe("user");
    expect(origin.from).toEqual([19.945, 50.0647]);
    expect(origin.area).toBeDefined();
    expect(origin.centre).not.toEqual(rynek);
  });

  it("uses the point the user chose when there is no device position", () => {
    // GIVEN a hand-picked district
    // WHEN the origin is resolved
    const origin = searchOrigin({ position: here, place: "Kazimierz" }, rynek);
    // THEN the source is the chosen point
    expect(origin.source).toBe("chosen");
    expect(origin.area).toBeDefined();
  });

  it("falls back to the map centre without claiming it is near the user", () => {
    // GIVEN no position and no chosen point
    // WHEN the origin is resolved
    const origin = searchOrigin(null, rynek);
    // THEN the map centre is used, with no area box and no user-relative distances
    expect(origin).toEqual({ source: "map", centre: rynek, from: null });
  });
});
