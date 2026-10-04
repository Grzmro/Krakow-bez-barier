import { describe, expect, it } from "vitest";
import type { FeatureMatch } from "@krakow-bez-barier/contracts";
import { nearestMatch, QUICK_ACTIONS, quickFilters, quickStillApplies, type QuickAction } from "./quick-actions";
import { ICON_KEYS } from "./categories";

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

  it("finds nothing when no place meets the filter by known data", () => {
    // GIVEN only places without an answer
    const items = [row("a"), row("b", "unknown")];
    // WHEN the nearest match is picked
    // THEN there is none: unknown is never accessible
    expect(nearestMatch(items, ["toilet_accessible"])).toBeNull();
    expect(nearestMatch([], ["toilet_accessible"])).toBeNull();
  });
});
