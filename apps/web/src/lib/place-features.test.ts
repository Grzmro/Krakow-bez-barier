import { describe, expect, it } from "vitest";
import type { SummaryChip } from "@krakow-bez-barier/contracts";
import { distanceMeters, filterGapStatus, summaryLine } from "./place-features";

const chip = (attribute: SummaryChip["attribute"], state: SummaryChip["state"], label?: string): SummaryChip => ({
  attribute,
  state,
  status: state === "known" ? "confirmed" : state === "conflict" ? "conflict" : "no_data",
  label,
});

describe("distanceMeters", () => {
  it("measures a short walk in the Old Town", () => {
    // GIVEN Rynek Główny and Sukiennice's entrance ~30 m north
    // WHEN measuring the distance
    const d = distanceMeters([19.9373, 50.0614], [19.9373, 50.0617]);

    // THEN it is about 30 m, rounded to 10 m
    expect(d).toBe(30);
  });

  it("is zero for the same point", () => {
    expect(distanceMeters([19.9, 50], [19.9, 50])).toBe(0);
  });
});

describe("filterGapStatus", () => {
  it("returns null when every filter is known", () => {
    // GIVEN a place with a known lift
    // WHEN the lift filter is on
    // THEN there is no gap
    expect(filterGapStatus([chip("lift", "known")], ["lift"])).toBeNull();
  });

  it("returns unknown for a missing attribute — unknown is never accessible", () => {
    // GIVEN a place without a lift chip
    // WHEN the lift filter is on
    // THEN the row shows "Brak danych"
    expect(filterGapStatus([chip("step_count", "known")], ["lift"])).toBe("unknown");
  });

  it("prefers conflict over unknown", () => {
    // GIVEN a conflicting toilet and an unknown lift
    // WHEN both filters are on
    // THEN conflict is shown
    expect(filterGapStatus([chip("toilet_accessible", "conflict")], ["lift", "toilet_accessible"])).toBe("conflict");
  });
});

describe("summaryLine", () => {
  it("joins chip labels and falls back for chips without one", () => {
    // GIVEN one labeled chip and one without a label
    const line = summaryLine([chip("lift", "known", "Winda"), chip("bench", "unknown")], (c) => `${c.attribute}?`);

    // THEN both appear, separated by a middle dot
    expect(line).toBe("Winda · bench?");
  });
});
