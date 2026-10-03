import { describe, expect, it } from "vitest";
import { checkReportNumber, reportRules } from "./report-rules";

describe("reportRules", () => {
  it("are extracted from ReportCreate in openapi.yaml", () => {
    // GIVEN the rules generated from the spec
    // WHEN reading the door width range and the comment limit
    // THEN they match the spec
    expect(reportRules.valueRanges.door_width_cm).toEqual({ min: 40, max: 300, unit: "cm" });
    expect(reportRules.commentMaxLength).toBe(500);
  });
});

describe("checkReportNumber", () => {
  it("accepts a value inside the range, including its bounds and a decimal comma", () => {
    // GIVEN door width bounds 40–300 cm
    // WHEN checking values at and inside the bounds
    // THEN they are accepted as numbers
    expect(checkReportNumber("door_width_cm", "40")).toEqual({ ok: true, value: 40 });
    expect(checkReportNumber("door_width_cm", " 300 ")).toEqual({ ok: true, value: 300 });
    expect(checkReportNumber("door_width_cm", "85,5")).toEqual({ ok: true, value: 85.5 });
  });

  it("rejects empty, non-numeric and out-of-range input with a reason", () => {
    // GIVEN door width bounds 40–300 cm
    // WHEN checking invalid input
    // THEN each result says why
    expect(checkReportNumber("door_width_cm", "")).toEqual({ ok: false, reason: "empty" });
    expect(checkReportNumber("door_width_cm", "abc")).toEqual({ ok: false, reason: "not_a_number" });
    expect(checkReportNumber("door_width_cm", "39")).toEqual({ ok: false, reason: "out_of_range" });
    expect(checkReportNumber("door_width_cm", "301")).toEqual({ ok: false, reason: "out_of_range" });
  });
});
