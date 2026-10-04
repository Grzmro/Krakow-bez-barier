import { describe, expect, it } from "vitest";
import { dataQuality, factAgeDays, median, percent, type QualityPlace } from "./data-quality";
import { bool, fact, NOW, num } from "./fixtures";
import { resolveAttributes } from "./resolver";
import type { AccessibilityFact } from "./types";

const place = (category: string, facts: AccessibilityFact[]): QualityPlace => ({
  category,
  attributes: resolveAttributes(facts, NOW),
});

const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const aged = (days: number) => ({ observedAt: daysAgo(days), fetchedAt: daysAgo(days) });

describe("dataQuality", () => {
  it("counts a place without facts as no data, never as covered", () => {
    // GIVEN one place with a fact and one with none, in the same category
    const places = [place("museum", [fact("step_count", num(0, "count"), aged(10))]), place("museum", [])];

    // WHEN the report is computed
    const report = dataQuality(places, { now: NOW });

    // THEN coverage is one of two and the category shows the gap
    expect(report.places).toEqual({ total: 2, withData: 1, withoutData: 1 });
    expect(report.categories).toEqual([
      { category: "museum", places: 2, withData: 1, withoutData: 1, conflictAttributes: 0, staleAttributes: 0, medianAgeDays: 10 },
    ]);
  });

  it("handles no places at all", () => {
    // GIVEN nothing in the database
    // WHEN the report is computed
    const report = dataQuality([], { now: NOW });

    // THEN every count is zero, the median is null and every reliability level is still listed
    expect(report.places).toEqual({ total: 0, withData: 0, withoutData: 0 });
    expect(report.facts.total).toBe(0);
    expect(report.facts.medianAgeDays).toBeNull();
    expect(report.categories).toEqual([]);
    expect(report.reliability.map((r) => r.facts)).toEqual([0, 0, 0, 0, 0]);
    expect(report.generatedAt).toBe(NOW.toISOString());
  });

  it("counts two sources disagreeing as a conflict, per attribute and per place", () => {
    // GIVEN a place whose lift is reported both ways by fresh sources, and a place without disagreement
    const conflicted = place("hotel", [fact("lift", bool(true)), fact("lift", bool(false), { sourceId: "msip" })]);
    const calm = place("hotel", [fact("lift", bool(true))]);

    // WHEN the report is computed
    const report = dataQuality([conflicted, calm], { now: NOW });

    // THEN one attribute in one place is a conflict
    expect(report.conflicts).toEqual({ places: 1, attributes: 1 });
    expect(report.categories[0].conflictAttributes).toBe(1);
  });

  it("measures the age of facts from the date they were last true, with a median and buckets", () => {
    // GIVEN facts last observed 10, 100, 200 and 400 days ago
    const places = [
      place("restaurant", [fact("step_count", num(0, "count"), aged(10)), fact("door_width_cm", num(90), aged(100))]),
      place("restaurant", [fact("step_count", num(1, "count"), aged(200)), fact("door_width_cm", num(80), aged(400))]),
    ];

    // WHEN the report is computed
    const { facts } = dataQuality(places, { now: NOW });

    // THEN the median is the mean of the middle two and each bucket holds one fact
    expect(facts.total).toBe(4);
    expect(facts.medianAgeDays).toBe(150);
    expect(facts.age).toEqual([
      { bucket: "within_90_days", facts: 1 },
      { bucket: "within_365_days", facts: 2 },
      { bucket: "older", facts: 1 },
    ]);
  });

  it("counts outdated attributes apart from missing ones", () => {
    // GIVEN a place whose only door fact is older than 12 months
    const stale = place("pharmacy", [fact("door_width_cm", num(80), aged(500))]);

    // WHEN the report is computed
    const report = dataQuality([stale], { now: NOW });

    // THEN the place has data (outdated) and is counted as stale, not as without data
    expect(report.places.withData).toBe(1);
    expect(report.staleData).toEqual({ places: 1, facts: 1 });
    expect(report.categories[0].staleAttributes).toBe(1);
  });

  it("orders categories by the largest gap and lists reliability and sources of the facts", () => {
    // GIVEN a covered museum, and two hotels without data, one fact from a confirmed official source
    const official = fact("step_count", num(0, "count"), { sourceId: "krakow", reliability: "confirmed", ...aged(5) });
    const places = [place("museum", [official]), place("hotel", []), place("hotel", [])];

    // WHEN the report is computed
    const report = dataQuality(places, { now: NOW });

    // THEN hotels (2 gaps) come first, the confirmed level has the fact and the source is listed with its newest fetch
    expect(report.categories.map((c) => c.category)).toEqual(["hotel", "museum"]);
    expect(report.reliability[0]).toEqual({ reliability: "confirmed", facts: 1 });
    expect(report.sources).toEqual([
      { sourceId: "krakow", name: "krakow", kind: "community", facts: 1, newestFetchedAt: daysAgo(5) },
    ]);
    expect(report.attributes.find((a) => a.attribute === "step_count")?.places).toBe(1);
  });

  it("labels an all-sample answer", () => {
    // GIVEN the example-data mode
    // WHEN the report is built with isSample
    // THEN the flag is carried so the page can say PRZYKŁAD
    expect(dataQuality([], { now: NOW, isSample: true }).isSample).toBe(true);
  });
});

describe("helpers", () => {
  it("median of nothing is null and of an even count rounds", () => {
    // GIVEN lists of ages
    // WHEN taking medians
    // THEN empty gives null and the mean of the middle pair is rounded
    expect(median([])).toBeNull();
    expect(median([1, 2])).toBe(2);
    expect(median([5, 1, 3])).toBe(3);
  });

  it("a fact observed in the future is zero days old", () => {
    // GIVEN a fact whose source date is after now
    const future = fact("lift", bool(true), { observedAt: daysAgo(-5), fetchedAt: daysAgo(-5) });

    // WHEN its age is measured
    // THEN it is 0, not negative
    expect(factAgeDays(future, NOW)).toBe(0);
  });

  it("percent of an empty total is 0", () => {
    // GIVEN a zero total
    // WHEN computing a share
    // THEN no division by zero
    expect(percent(0, 0)).toBe(0);
    expect(percent(1, 3)).toBe(33);
  });
});
