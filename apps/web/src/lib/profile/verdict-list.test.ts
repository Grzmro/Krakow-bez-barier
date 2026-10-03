import { describe, expect, it } from "vitest";
import type { PlaceSummary, Verdict } from "@krakow-bez-barier/contracts";
import { countByStatus, filterByVerdict } from "./verdict-list";

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
