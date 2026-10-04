import { describe, expect, it } from "vitest";
import { clampStep } from "./number-stepper-value";

const range = { min: 0, max: 20 };

describe("clampStep", () => {
  it("reads a comma decimal as typed on a Polish keyboard", () => {
    // GIVEN a value typed with a decimal comma
    // WHEN it is committed
    const value = clampStep("2,5", range);

    // THEN it is the number
    expect(value).toBe(2.5);
  });

  it.each([
    ["-4", 0],
    ["99", 20],
  ])("clamps %s into the range", (raw, expected) => {
    // GIVEN a value outside the range
    // WHEN it is committed
    // THEN it lands on the nearest limit
    expect(clampStep(raw, range)).toBe(expected);
  });

  it.each(["", "  ", "abc"])("keeps the current value for %j", (raw) => {
    // GIVEN an empty or non-numeric entry
    // WHEN it is committed
    // THEN nothing is changed (no jump to 0)
    expect(clampStep(raw, range)).toBeNull();
  });
});
