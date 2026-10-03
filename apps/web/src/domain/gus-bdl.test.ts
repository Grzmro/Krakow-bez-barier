import { describe, expect, it } from "vitest";
import { GUS_BDL_INDICATORS, gusIndicator, gusSnapshot, latestBdlValue } from "./gus-bdl";

describe("latestBdlValue", () => {
  it("picks the latest year with a value for the variable", () => {
    // GIVEN a BDL by-unit response with two years and an empty one
    const response = {
      results: [
        { id: 72305, values: [{ year: "2024", val: 809168 }, { year: "2025", val: 816614 }, { year: "2026", val: null }] },
      ],
    };

    // WHEN the latest value is read
    const latest = latestBdlValue(response, 72305);

    // THEN it is the newest year that has a number
    expect(latest).toEqual({ year: 2025, value: 816614 });
  });

  it("fails loudly when the variable has no value", () => {
    // GIVEN a response without the variable
    const response = { results: [] };

    // WHEN / THEN reading it throws instead of recording a guess
    expect(() => latestBdlValue(response, 1701558)).toThrow("variable 1701558");
  });
});

describe("the recorded GUS BDL snapshot", () => {
  it("has every indicator with its variable, year and a fetch date", () => {
    // GIVEN the snapshot committed with the app
    // WHEN each indicator is looked up
    const found = GUS_BDL_INDICATORS.map((i) => gusIndicator(i.key));

    // THEN each carries the variable id it came from, a year and a value, and the snapshot has its fetch date
    for (const [n, indicator] of found.entries()) {
      expect(indicator.variableId).toBe(GUS_BDL_INDICATORS[n].variableId);
      expect(indicator.year).toBeGreaterThan(2000);
      expect(indicator.value).toBeGreaterThan(0);
    }
    expect(Number.isNaN(Date.parse(gusSnapshot.fetchedAt))).toBe(false);
  });
});
