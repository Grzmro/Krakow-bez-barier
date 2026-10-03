import { describe, expect, it } from "vitest";
import type { ReportStatus } from "@krakow-bez-barier/contracts";
import { cityStats, type CityPlace } from "./city-stats";
import { bool, fact, NOW, num, text } from "./fixtures";
import { resolveAttributes } from "./resolver";
import type { AccessibilityFact } from "./types";

function place(
  id: string,
  facts: AccessibilityFact[],
  { category = "restaurant", reports = [] }: { category?: string; reports?: ReportStatus[] } = {},
): CityPlace {
  return {
    id,
    name: id,
    category,
    location: { type: "Point", coordinates: [19.94, 50.06] },
    attributes: resolveAttributes(facts, NOW),
    reports: reports.map((status) => ({ status })),
  };
}

describe("cityStats", () => {
  it("counts places with and without data, and never counts missing data as met", () => {
    // GIVEN a place with a step-free, wide entrance and a place without any fact
    const good = place("good", [fact("step_count", num(0, "count")), fact("threshold_cm", num(1)), fact("door_width_cm", num(95))]);
    const empty = place("empty", []);

    // WHEN the statistics are computed
    const stats = cityStats([good, empty], { now: NOW });

    // THEN one place has data, one has none, and the entrance is met once and unknown once
    expect(stats.places).toEqual({ total: 2, withData: 1, withoutData: 1 });
    expect(stats.needs.find((n) => n.need === "entrance")).toEqual({ need: "entrance", met: 1, barrier: 0, unknown: 1, conflict: 0 });
    expect(stats.needs.map((n) => n.need)).toEqual(["entrance", "door", "lift", "toilet", "surface"]);
  });

  it("counts reports by status, stale facts and conflicts", () => {
    // GIVEN a place with two reports, an outdated fact and two sources disagreeing on the lift
    const p = place(
      "p",
      [
        fact("door_width_cm", num(80), { observedAt: "2024-01-01T00:00:00Z", fetchedAt: "2024-01-01T00:00:00Z" }),
        fact("lift", bool(true)),
        fact("lift", bool(false), { sourceId: "msip" }),
      ],
      { reports: ["new", "accepted"] },
    );

    // WHEN the statistics are computed
    const stats = cityStats([p], { now: NOW });

    // THEN every report status is listed, and the stale fact and the conflict are counted
    expect(stats.reports).toEqual([
      { status: "new", count: 1 },
      { status: "needs_info", count: 0 },
      { status: "accepted", count: 1 },
      { status: "rejected", count: 0 },
    ]);
    expect(stats.staleData).toEqual({ places: 1, facts: 1 });
    expect(stats.conflicts).toEqual({ places: 1, attributes: 1 });
  });

  it("ranks a known barrier above a missing-data place, with reasons that add up to the score", () => {
    // GIVEN a restaurant whose entrance OSM marks as not wheelchair accessible, with an open report,
    // a pharmacy we know nothing about, and a place with nothing to do
    const barrier = place("Bar", [fact("wheelchair_overall", text("no"))], { reports: ["needs_info"] });
    const unknownPharmacy = place("Apteka", [], { category: "pharmacy" });
    const fine = place("Ok", [fact("ramp", bool(true)), fact("door_width_cm", num(100)), fact("levels", num(1, "count")), fact("toilet_accessible", bool(true)), fact("surface", text("asphalt"))]);

    // WHEN the statistics are computed
    const { priorities } = cityStats([unknownPharmacy, fine, barrier], { now: NOW });

    // THEN the barrier is first and marked for repair, the pharmacy second for filling in data, the fine place absent
    expect(priorities.total).toBe(2);
    expect(priorities.items.map((i) => [i.rank, i.placeId, i.action, i.score])).toEqual([
      [1, "Bar", "fix", 4 + 3],
      [2, "Apteka", "verify", 1 + 2],
    ]);
    expect(priorities.items[0].barriers).toEqual(["entrance"]);
    expect(priorities.items[0].reasons).toEqual([
      { factor: "barrier", count: 1, points: 4 },
      { factor: "open_report", count: 1, points: 3 },
    ]);
    for (const item of priorities.items) {
      expect(item.reasons.reduce((s, r) => s + r.points, 0)).toBe(item.score);
    }
  });

  it("gives a busy category no points on its own and caps open reports at three", () => {
    // GIVEN a fully described museum with five open reports
    const facts = [fact("ramp", bool(true)), fact("door_width_cm", num(100)), fact("levels", num(1, "count")), fact("toilet_accessible", bool(true)), fact("surface", text("asphalt"))];
    const busyFine = place("Muzeum", facts, { category: "museum" });
    const reported = place("Zgłaszane", facts, { reports: ["new", "new", "new", "new", "needs_info"] });

    // WHEN the statistics are computed with a ranking of one
    const { priorities } = cityStats([busyFine, reported], { now: NOW, limit: 1 });

    // THEN the museum is not ranked, and the reported place gets 3 × 3 points while reporting all 5
    expect(priorities.total).toBe(1);
    expect(priorities.items).toHaveLength(1);
    expect(priorities.items[0]).toMatchObject({ placeId: "Zgłaszane", score: 9, openReports: 5, action: "verify" });
  });
});
