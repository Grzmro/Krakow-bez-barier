import { describe, expect, it } from "vitest";
import { checkReportNumber, reportRules } from "./report-rules";

describe("reportRules", () => {
  it("are extracted from ReportCreate in openapi.yaml", () => {
    // GIVEN the rules generated from the spec
    // WHEN reading the door width range and the comment limit
    // THEN they match the spec
    expect(reportRules.valueRanges.door_width_cm).toEqual({ min: 10, max: 300, unit: "cm" });
    expect(reportRules.commentMaxLength).toBe(500);
  });
});

describe("checkReportNumber", () => {
  it("accepts a value inside the range, including its bounds and a decimal comma", () => {
    // GIVEN door width bounds 10–300 cm
    // WHEN checking values at and inside the bounds
    // THEN they are accepted as numbers
    expect(checkReportNumber("door_width_cm", "10")).toEqual({ ok: true, value: 10 });
    expect(checkReportNumber("door_width_cm", " 300 ")).toEqual({ ok: true, value: 300 });
    expect(checkReportNumber("door_width_cm", "85,5")).toEqual({ ok: true, value: 85.5 });
  });

  it("rejects empty, non-numeric and out-of-range input with a reason", () => {
    // GIVEN door width bounds 10–300 cm
    // WHEN checking invalid input
    // THEN each result says why
    expect(checkReportNumber("door_width_cm", "")).toEqual({ ok: false, reason: "empty" });
    expect(checkReportNumber("door_width_cm", "abc")).toEqual({ ok: false, reason: "not_a_number" });
    expect(checkReportNumber("door_width_cm", "5")).toEqual({ ok: false, reason: "out_of_range" });
    expect(checkReportNumber("door_width_cm", "301")).toEqual({ ok: false, reason: "out_of_range" });
  });

  it("rejects number notations other than plain decimals", () => {
    // GIVEN input that JavaScript's Number() would still parse
    // WHEN checking it as a door width
    // THEN it is not a number for the visitor
    for (const raw of ["1e2", "0x50", "-80", "80cm", "8 0", "1,2,3"]) {
      expect(checkReportNumber("door_width_cm", raw)).toEqual({ ok: false, reason: "not_a_number" });
    }
  });

  it("requires a whole number for counts", () => {
    // GIVEN step count, measured in units of `count`
    // WHEN checking a fraction and a whole number
    // THEN only the whole number passes
    expect(checkReportNumber("step_count", "2,5")).toEqual({ ok: false, reason: "not_whole" });
    expect(checkReportNumber("step_count", "3")).toEqual({ ok: true, value: 3 });
  });
});
