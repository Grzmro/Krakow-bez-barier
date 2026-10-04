import { describe, expect, it } from "vitest";
import { featureMatch, featureState } from "./features";
import type { AccessibilityAttribute, AccessibilityFact, ResolvedAttribute } from "./types";

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
    expect(featureState([stale], "lift")).toBe("stale");
    expect(featureState([conflict], "lift")).toBe("conflict");
  });
});

describe("featureMatch", () => {
  const now = new Date("2026-10-04T00:00:00Z");
  const fact = (dates: Partial<AccessibilityFact>): AccessibilityFact =>
    ({ id: "f", attribute: "toilet_accessible", value: { kind: "boolean", boolean: true }, fetchedAt: "2026-10-01T00:00:00Z", ...dates }) as AccessibilityFact;
  const outdated = (value: boolean, facts: AccessibilityFact[]): ResolvedAttribute => ({
    attribute: "toilet_accessible",
    state: "stale",
    status: "outdated",
    value: { kind: "boolean", boolean: value },
    facts,
  });

  it("dates an outdated yes as stale, from when its newest fact was last true", () => {
    // GIVEN an accessible toilet known only from a page dated 15.09.2025 (fetched recently)
    const attributes = [outdated(true, [fact({ observedAt: "2025-09-15T00:00:00Z" }), fact({ observedAt: "2025-01-01T00:00:00Z" })])];
    // WHEN checking the toilet_accessible feature
    // THEN it is stale with the page date, not met
    expect(featureMatch(attributes, "toilet_accessible", now)).toEqual({
      feature: "toilet_accessible",
      state: "stale",
      asOf: "2025-09-15T00:00:00.000Z",
    });
  });

  it("does not take an outdated no as proof of absence", () => {
    // GIVEN only outdated data saying there is no accessible toilet
    const attributes = [outdated(false, [fact({ observedAt: "2024-01-01T00:00:00Z" })])];
    // WHEN checking the feature
    // THEN we can't say
    expect(featureMatch(attributes, "toilet_accessible", now).state).toBe("unknown");
  });

  it("prefers a fresh known alternative over an outdated one", () => {
    // GIVEN steps known to be absent (fresh) and an outdated ramp
    const ramp: ResolvedAttribute = { ...known("ramp", { kind: "boolean", boolean: true }), state: "stale", status: "outdated" };
    // WHEN checking step_free with and without the fresh zero steps
    // THEN fresh data decides; the outdated ramp alone only makes it stale
    expect(featureMatch([steps(0), ramp], "step_free", now).state).toBe("met");
    expect(featureMatch([steps(2), ramp], "step_free", now).state).toBe("stale");
  });
});
