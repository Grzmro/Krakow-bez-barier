import { describe, expect, it } from "vitest";
import type { NeedResult, PlaceSummary, Verdict } from "@krakow-bez-barier/contracts";
import { countByStatus, filterByVerdict, filterPointsByVerdict, missingNeeds } from "./verdict-list";

function item(id: string, state: Verdict["state"] | null) {
  const place = {
    id,
    verdict: state ? { state, reasons: [], unconfirmed: false } : null,
  } as unknown as PlaceSummary;
  return { place };
}

const ids = (items: { place: PlaceSummary }[]) => items.map(({ place }) => place.id);

describe("countByStatus", () => {
  it("counts each verdict and ignores places without one", () => {
    // GIVEN places with mixed verdicts and one without
    const items = [item("a", "met"), item("b", "barrier"), item("c", "barrier"), item("d", null)];
    // WHEN counting
    // THEN every status has a number, zero included
    expect(countByStatus(items)).toEqual({ met: 1, barrier: 2, conflict: 0, unknown: 0 });
  });
});

describe("filterByVerdict", () => {
  const items = [item("near-barrier", "barrier"), item("unknown", "unknown"), item("met", "met"), item("far-barrier", "barrier"), item("conflict", "conflict")];

  it("leaves a list without verdicts untouched", () => {
    // GIVEN a list loaded without a profile
    const plain = [item("b", null), item("a", null)];
    // WHEN filtering with every option on
    // THEN nothing is hidden or reordered
    expect(filterByVerdict(plain, { status: "met", hideFailing: true })).toBe(plain);
  });

  it("orders met, conflict, unknown, barrier and keeps distance order within a status", () => {
    // GIVEN places sorted by distance
    // WHEN no filter is active
    // THEN verdicts are grouped, nearer first inside each group
    expect(ids(filterByVerdict(items, { status: null, hideFailing: false }))).toEqual([
      "met",
      "conflict",
      "unknown",
      "near-barrier",
      "far-barrier",
    ]);
  });

  it("shows one status when a counter is pressed and hides barriers on request", () => {
    // GIVEN the same places
    // WHEN a counter is pressed, or failing places are hidden
    // THEN only the matching places stay
    expect(ids(filterByVerdict(items, { status: "barrier", hideFailing: false }))).toEqual(["near-barrier", "far-barrier"]);
    expect(ids(filterByVerdict(items, { status: null, hideFailing: true }))).toEqual(["met", "conflict", "unknown"]);
  });
});

describe("missingNeeds", () => {
  const withNeeds = (id: string, needs: [NeedResult["need"], NeedResult["state"]][]) => {
    const place = {
      id,
      verdict: { state: "unknown", reasons: [], needs: needs.map(([need, state]) => ({ need, attribute: "step_count", state })) },
    } as unknown as PlaceSummary;
    return { place };
  };

  it("counts places per need that lacks data, most often missing first", () => {
    // GIVEN places where the door is unknown twice and the entrance once, plus a met and a barrier need
    const items = [
      withNeeds("a", [["entrance", "unknown"], ["door", "unknown"], ["lift", "met"]]),
      withNeeds("b", [["entrance", "barrier"], ["door", "unknown"]]),
      item("c", null),
    ];
    // WHEN counting the missing needs
    // THEN only unknown needs count, sorted by how many places lack them
    expect(missingNeeds(items)).toEqual([
      { need: "door", count: 2 },
      { need: "entrance", count: 1 },
    ]);
  });

  it("is empty when no place lacks data", () => {
    // GIVEN places with verdicts but no per-need breakdown
    // WHEN counting
    // THEN nothing is missing
    expect(missingNeeds([item("a", "met"), item("b", "barrier")])).toEqual([]);
  });
});

describe("filterPointsByVerdict", () => {
  const point = (id: string, verdict: Verdict["state"] | null) => ({ id, verdict });

  it("applies the same status filters to map points as to the list", () => {
    // GIVEN points with every verdict
    const points = [point("met", "met"), point("barrier", "barrier"), point("unknown", "unknown"), point("conflict", "conflict")];

    // WHEN one status is pressed, then failing places are hidden
    const onlyUnknown = filterPointsByVerdict(points, { status: "unknown", hideFailing: false });
    const noBarriers = filterPointsByVerdict(points, { status: null, hideFailing: true });

    // THEN the map keeps exactly the matching points
    expect(onlyUnknown.map((p) => p.id)).toEqual(["unknown"]);
    expect(noBarriers.map((p) => p.id)).toEqual(["met", "unknown", "conflict"]);
  });

  it("leaves points without verdicts untouched", () => {
    // GIVEN points loaded without a profile
    const points = [point("a", null), point("b", null)];

    // WHEN / THEN a leftover status filter hides nothing
    expect(filterPointsByVerdict(points, { status: "met", hideFailing: true })).toBe(points);
  });
});
