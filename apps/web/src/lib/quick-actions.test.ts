import { describe, expect, it } from "vitest";
import type { FeatureMatch } from "@krakow-bez-barier/contracts";
import { nearestMatch, nearestStaleMatch, QUICK_ACTIONS, quickAnnouncement, quickOutcome, quickFilters, quickStillApplies, type QuickAction } from "./quick-actions";
import { ICON_KEYS } from "./categories";
import { pl } from "@/i18n/pl";

const toilet = QUICK_ACTIONS.find((a) => a.id === "toilet") as QuickAction;
const rest = QUICK_ACTIONS.find((a) => a.id === "rest") as QuickAction;

const row = (id: string, state?: FeatureMatch["state"]) => ({
  id,
  place: { features: state ? [{ feature: "toilet_accessible" as const, state }] : undefined },
});

describe("QUICK_ACTIONS", () => {
  it("uses only icons the web UI can draw and unique ids", () => {
    // GIVEN the configured quick actions
    // WHEN their icon keys and ids are checked
    // THEN each icon is drawable and no id repeats
    for (const action of QUICK_ACTIONS) expect(ICON_KEYS).toContain(action.icon);
    expect(new Set(QUICK_ACTIONS.map((a) => a.id)).size).toBe(QUICK_ACTIONS.length);
  });

  it("runs the transit stop action on stops without a filter no stop data could pass", () => {
    // GIVEN the transit stop action, now that stops come from OSM
    const stop = QUICK_ACTIONS.find((a) => a.id === "transit_stop") as QuickAction;
    // WHEN it is read
    // THEN it is available and lists stops nearest first, not only those known to be step-free
    expect(quickFilters(stop)).toEqual({ category: "transit_stop", features: [] });
    expect(nearestMatch([row("a"), row("b")], stop.features)?.id).toBe("a");
  });
});

describe("quickStillApplies", () => {
  it("holds while the list has the action's category and features, in any order", () => {
    // GIVEN the toilet action and the rest action (no category)
    // WHEN the list shows exactly their filters
    // THEN they still apply
    expect(quickStillApplies(toilet, { category: "toilet", features: ["toilet_accessible"] })).toBe(true);
    expect(quickStillApplies(rest, { category: null, features: ["bench"] })).toBe(true);
  });

  it("ends once the user changes the category or a feature filter", () => {
    // GIVEN the toilet action
    // WHEN the category or features differ
    // THEN it no longer applies
    expect(quickStillApplies(toilet, { category: null, features: ["toilet_accessible"] })).toBe(false);
    expect(quickStillApplies(toilet, { category: "toilet", features: ["toilet_accessible", "lift"] })).toBe(false);
    expect(quickStillApplies(toilet, { category: "toilet", features: [] })).toBe(false);
  });

  it("hands out a copy of the features", () => {
    // GIVEN the filters of an action
    const { features } = quickFilters(toilet);
    // WHEN the copy is changed
    features.push("lift");
    // THEN the config is untouched
    expect(toilet.features).toEqual(["toilet_accessible"]);
  });
});

describe("nearestMatch", () => {
  it("skips nearer places that have no data or conflicting data", () => {
    // GIVEN nearest first: unknown, conflict, then a met place
    const items = [row("a", "unknown"), row("b", "conflict"), row("c", "met"), row("d", "met")];
    // WHEN the nearest match for an accessible toilet is picked
    const nearest = nearestMatch(items, ["toilet_accessible"]);
    // THEN it is the first place that meets the filter by known data
    expect(nearest?.id).toBe("c");
  });

  it("never takes outdated data as a match", () => {
    // GIVEN only a place whose accessible toilet is known from outdated data
    // WHEN the nearest match is picked
    // THEN there is none: stale is not met
    expect(nearestMatch([row("a", "stale")], ["toilet_accessible"])).toBeNull();
  });

  it("finds nothing when no place meets the filter by known data", () => {
    // GIVEN only places without an answer
    const items = [row("a"), row("b", "unknown")];
    // WHEN the nearest match is picked
    // THEN there is none: unknown is never accessible
    expect(nearestMatch(items, ["toilet_accessible"])).toBeNull();
    expect(nearestMatch([], ["toilet_accessible"])).toBeNull();
  });
});

describe("quickAnnouncement", () => {
  const place = { id: "t", name: "Toaleta publiczna", category: "toilet", location: { type: "Point" as const, coordinates: [19.94, 50.06] }, summary: [], isSample: false };

  it("says an outdated result is outdated, with its date", () => {
    // GIVEN the toilet action found a toilet only by data from 15.09.2025
    const state = { kind: "found" as const, place, distance: 600, from: "user" as const, stale: { asOf: "2025-09-15T00:00:00Z" } };
    // WHEN it is announced in Polish
    const said = quickAnnouncement(pl, "pl", toilet, state);
    // THEN the sentence names the place, the distance and that it may be outdated, with the date
    expect(said).toBe("Najbliższa toaleta dostosowana: Toaleta publiczna, 600 m od Ciebie. Może być nieaktualne · 15.09.2025");
  });

  it("joins into the live region without a doubled full stop when nothing is nearby", () => {
    // GIVEN no result at all
    // WHEN the announcement is joined with the list's like the home screen does
    const said = [quickAnnouncement(pl, "pl", toilet, { kind: "none" }), "Nie znaleziono miejsc"].join(". ");
    // THEN there is a single full stop between them
    expect(said).not.toContain("..");
  });
});

describe("quickOutcome", () => {
  const place = { id: "t", name: "Toaleta publiczna", category: "toilet", location: { type: "Point" as const, coordinates: [19.94, 50.06] }, summary: [], isSample: false };
  const stalePlace = { ...place, features: [{ feature: "toilet_accessible" as const, state: "stale" as const, asOf: "2025-09-15T00:00:00Z" }] };
  const base = { hasLocation: true, listReady: true, strict: null, needsLookup: true, features: ["toilet_accessible"] as const, from: "user" as const };

  it("prefers the strict match and never looks further", () => {
    // GIVEN a fresh match in the list
    // WHEN the outcome is decided
    const outcome = quickOutcome({ ...base, strict: { place, distance: 300 }, needsLookup: false, lookup: { status: "loading" } });
    // THEN it is that place, not marked outdated
    expect(outcome).toEqual({ kind: "found", place, distance: 300, from: "user" });
  });

  it("shows the nearest outdated match, dated, once the lookup answers", () => {
    // GIVEN no fresh match and a lookup that found an outdated "yes" 600 m away
    // WHEN the outcome is decided
    const outcome = quickOutcome({ ...base, lookup: { status: "done", items: [{ place: stalePlace, distance: 600 }] } });
    // THEN it is found as stale with its date
    expect(outcome).toEqual({ kind: "found", place: stalePlace, distance: 600, from: "user", stale: { asOf: "2025-09-15T00:00:00Z" } });
  });

  it("says 'none' only after the lookup answered with nothing, not while it loads or after it failed", () => {
    // GIVEN no fresh match
    // WHEN the lookup loads, fails, or answers empty
    // THEN only the empty answer is "none"
    expect(quickOutcome({ ...base, lookup: { status: "loading" } }).kind).toBe("searching");
    expect(quickOutcome({ ...base, lookup: { status: "error" } }).kind).toBe("searching");
    expect(quickOutcome({ ...base, lookup: { status: "done", items: [{ place, distance: 100 }] } }).kind).toBe("none");
  });
});

describe("nearestStaleMatch", () => {
  const dated = (id: string, asOf?: string) => ({
    id,
    place: { features: [{ feature: "toilet_accessible" as const, state: "stale" as const, ...(asOf ? { asOf } : {}) }] },
  });

  it("picks the nearest place known to have the feature only from outdated data, with its date", () => {
    // GIVEN nearest first: no data, absent, then two outdated "yes" (krakow.pl toilets dated 15.09.2025)
    const items = [row("a", "unknown"), row("b", "absent"), dated("c", "2025-09-15T00:00:00Z"), dated("d")];
    // WHEN the nearest outdated match is picked
    const found = nearestStaleMatch(items, ["toilet_accessible"]);
    // THEN it is the first outdated "yes", dated
    expect(found?.item.id).toBe("c");
    expect(found?.asOf).toBe("2025-09-15T00:00:00Z");
  });

  it("finds nothing among places without data, and nothing for an action without a filter", () => {
    // GIVEN places without data and a met place (the strict match answers that one)
    // WHEN the nearest outdated match is picked
    // THEN there is none, and an action without features never looks
    expect(nearestStaleMatch([row("a"), row("b", "unknown"), row("c", "met")], ["toilet_accessible"])).toBeNull();
    expect(nearestStaleMatch([dated("a")], [])).toBeNull();
  });
});
