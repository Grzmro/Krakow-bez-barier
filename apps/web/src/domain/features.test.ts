import { describe, expect, it } from "vitest";
import { featureState } from "./features";
import type { AccessibilityAttribute, ResolvedAttribute } from "./types";

const known = (attribute: AccessibilityAttribute, value: ResolvedAttribute["value"]): ResolvedAttribute => ({
  attribute,
  state: "known",
  status: "confirmed",
  value,
  facts: [],
});
const steps = (n: number) => known("step_count", { kind: "number", number: n, unit: "count" });
const ramp = (b: boolean) => known("ramp", { kind: "boolean", boolean: b });

describe("featureState", () => {
  it("is met by any known alternative of a step-free entrance", () => {
    // GIVEN two steps with a ramp, and no steps at all
    // WHEN checking the step_free feature
    // THEN both are met
    expect(featureState([steps(2), ramp(true)], "step_free")).toBe("met");
    expect(featureState([steps(0)], "step_free")).toBe("met");
  });

  it("is absent only when every alternative is known to be missing", () => {
    // GIVEN steps without ramp data, and steps with no ramp
    // WHEN checking the step_free feature
    // THEN missing ramp data is unknown, a known lack of ramp is absent
    expect(featureState([steps(2)], "step_free")).toBe("unknown");
    expect(featureState([steps(2), ramp(false)], "step_free")).toBe("absent");
  });

  it("never lets stale or conflicting data through", () => {
    // GIVEN an outdated lift and a disputed lift
    const stale: ResolvedAttribute = { ...known("lift", { kind: "boolean", boolean: true }), state: "stale", status: "outdated" };
    const conflict: ResolvedAttribute = { attribute: "lift", state: "conflict", status: "conflict", value: null, facts: [] };
    // WHEN checking the lift feature
    // THEN neither counts as met
    expect(featureState([stale], "lift")).toBe("unknown");
    expect(featureState([conflict], "lift")).toBe("conflict");
  });
});
