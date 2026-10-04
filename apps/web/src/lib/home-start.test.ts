import { describe, expect, it } from "vitest";
import { choose, clearQuery, commitChange, confirmAction, draftAsk, escapeStep, homeView, isSearching, NO_CHOICES, panelAfterAsk, runAsk, searchOrigin, showResults, START_SELECTION, widenSearch } from "./home-start";

const start = { q: "", category: null, features: [], nearby: null };
const rynek: [number, number] = [19.9372, 50.0617];
const here = { latitude: 50.0647, longitude: 19.945 };

describe("widenSearch", () => {
  it("keeps the typed name and drops what narrowed it", () => {
    // GIVEN "Qubus" searched among museums around the user
    const draft = { ...NO_CHOICES, category: "museum", features: ["lift" as const], nearby: { position: here } };
    const selection = { committed: { q: "Qubus", ...draft }, draft };

    // WHEN "Szukaj w całym Krakowie" widens it
    const widened = widenSearch(selection);

    // THEN the name alone is searched across the city
    expect(widened).toEqual({ committed: { q: "Qubus", ...NO_CHOICES }, draft: NO_CHOICES });
  });

  it("has nothing to offer when the name alone was already searched city-wide", () => {
    // GIVEN only a name, no category, filter or area
    const selection = { committed: { q: "Zzzz", ...NO_CHOICES }, draft: NO_CHOICES };

    // WHEN asking for the wider search
    // THEN there is none
    expect(widenSearch(selection)).toBeNull();
  });

  it("returns to the start when no name was typed", () => {
    // GIVEN a category browsed around the user
    const draft = { ...NO_CHOICES, category: "toilet", nearby: { position: here } };

    // WHEN widening
    // THEN the start comes back
    expect(widenSearch({ committed: { q: "", ...draft }, draft })).toBe(START_SELECTION);
  });
});

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

describe("draft vs committed selection", () => {
  it("keeps results unchanged while options are picked", () => {
    // GIVEN the start state
    // WHEN a category and a feature are picked
    const picked = choose(choose(START_SELECTION, { category: "toilet" }), { features: ["lift"] });
    // THEN only the draft changed: no query, so no list and no pins
    expect(picked.draft).toMatchObject({ category: "toilet", features: ["lift"] });
    expect(homeView(picked.committed, searchOrigin(null, rynek)).searching).toBe(false);
  });

  it("loads the results once the draft is shown", () => {
    // GIVEN a draft with a category
    const picked = choose(START_SELECTION, { category: "toilet" });
    // WHEN the results are shown with typed text
    const shown = showResults(picked, " winda ");
    // THEN the query holds the draft and the trimmed text
    expect(shown.committed).toMatchObject({ q: "winda", category: "toilet" });
    expect(homeView(shown.committed, searchOrigin(null, rynek)).panel).toBe("results");
  });

  it("leaves the shown results alone when the draft changes afterwards", () => {
    // GIVEN shown results for a category
    const shown = showResults(choose(START_SELECTION, { category: "toilet" }), "");
    // WHEN another category is picked
    const next = choose(shown, { category: "pharmacy" });
    // THEN the query still holds the first one
    expect(next.committed.category).toBe("toilet");
  });

  it("drops 'show places without data' with the last feature", () => {
    // GIVEN a feature with unknown places shown
    const on = choose(START_SELECTION, { features: ["lift"], showUnknown: true });
    // WHEN the feature is unpicked
    // THEN the switch goes with it
    expect(choose(on, { features: [] }).draft.showUnknown).toBe(false);
  });

  it("asks at once for a command and replaces the choices", () => {
    // GIVEN a draft with a feature and a position
    const before = choose(choose(START_SELECTION, { features: ["bench"] }), { nearby: { position: here } });
    // WHEN a quick action runs
    const asked = runAsk(before, { category: "toilet", features: ["toilet_accessible"] });
    // THEN draft and query are equal, the position is kept, and nothing is left to confirm
    expect(asked.committed).toEqual({ q: "", category: "toilet", features: ["toilet_accessible"], showUnknown: false, nearby: { position: here } });
    expect(asked.draft).toEqual({ category: "toilet", features: ["toilet_accessible"], showUnknown: false, nearby: { position: here } });
    expect(confirmAction(asked, "")).toBe("hidden");
  });

  it("adds a position that arrives for a command to both", () => {
    // GIVEN a command that waits for the position
    const asked = runAsk(START_SELECTION, { category: "toilet" });
    // WHEN it arrives
    const located = commitChange(asked, { nearby: { position: here } });
    // THEN the query has it
    expect(located.committed.nearby).toEqual({ position: here });
    expect(located.draft.nearby).toEqual({ position: here });
  });

  it("returns to the clean map when the only query text is cleared", () => {
    // GIVEN results for typed text
    const shown = showResults(START_SELECTION, "sukiennice");
    // WHEN the search field is cleared
    const cleared = clearQuery(shown);
    // THEN the query is empty and so are the results
    expect(isSearching(cleared.committed)).toBe(false);
  });

  it("keeps the other choices when the typed text is cleared", () => {
    // GIVEN results for text and a category
    const shown = showResults(choose(START_SELECTION, { category: "toilet" }), "x");
    // WHEN the text is cleared
    // THEN the category stays
    expect(clearQuery(shown).committed).toMatchObject({ q: "", category: "toilet" });
  });

  it("returns to the clean map with the start selection", () => {
    // GIVEN shown results
    const shown = showResults(choose(START_SELECTION, { category: "toilet" }), "x");
    expect(isSearching(shown.committed)).toBe(true);
    // WHEN the selection is reset
    // THEN nothing is asked and nothing is left to confirm
    expect(isSearching(START_SELECTION.committed)).toBe(false);
    expect(confirmAction(START_SELECTION, "")).toBe("hidden");
  });
});

describe("confirmAction", () => {
  it("offers the results once an option is picked", () => {
    // GIVEN a picked category
    // THEN the button shows results
    expect(confirmAction(choose(START_SELECTION, { category: "toilet" }), "")).toBe("show");
  });

  it("offers the results for typed text not yet searched", () => {
    expect(confirmAction(START_SELECTION, "kawa")).toBe("show");
  });

  it("is hidden once the draft is the query", () => {
    // GIVEN the draft shown
    const shown = showResults(choose(START_SELECTION, { category: "toilet" }), "");
    // THEN nothing is left to confirm
    expect(confirmAction(shown, "")).toBe("hidden");
  });

  it("offers a way back when everything was unpicked while results are up", () => {
    // GIVEN shown results whose draft was emptied
    const shown = showResults(choose(START_SELECTION, { category: "toilet" }), "");
    const emptied = choose(shown, { category: null });
    // THEN the button clears instead of showing everything
    expect(confirmAction(emptied, "")).toBe("clear");
    expect(draftAsk(emptied, "")).toBeNull();
  });

  it("gives the count request the draft", () => {
    // GIVEN a picked category and typed text
    // THEN the count filters hold both
    expect(draftAsk(choose(START_SELECTION, { category: "toilet" }), " a ")).toMatchObject({ q: "a", category: "toilet" });
  });
});
