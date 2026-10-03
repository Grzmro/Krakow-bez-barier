import { describe, expect, it } from "vitest";
import type { AccessibilityAttribute, Place, ResolvedAttribute } from "@krakow-bez-barier/contracts";
import { DEFAULT_THRESHOLDS } from "@/lib/profile/thresholds";
import { mockGetPlace, mockListPlaces } from "./mock-api";
import { mockVerdict } from "./mock-verdict";

const wheelchair = DEFAULT_THRESHOLDS.wheelchair;
const stroller = DEFAULT_THRESHOLDS.stroller;

function known(attribute: AccessibilityAttribute, value: ResolvedAttribute["value"], status: "confirmed" | "unverified" = "confirmed"): ResolvedAttribute {
  return { attribute, state: "known", status, value, facts: [] };
}
const num = (number: number) => ({ kind: "number" as const, number });
const bool = (boolean: boolean) => ({ kind: "boolean" as const, boolean });

const fullyAccessible: Pick<Place, "attributes"> = {
  attributes: [
    known("step_count", num(0)),
    known("threshold_cm", num(1)),
    known("door_width_cm", num(90)),
    known("lift", bool(true)),
    known("toilet_accessible", bool(true)),
  ],
};

describe("mockVerdict", () => {
  it("returns met only when every need is known and met", () => {
    // GIVEN a place whose every wheelchair need is confirmed
    // WHEN it is checked against the wheelchair presets
    const verdict = mockVerdict(fullyAccessible, wheelchair);
    // THEN it is met and not marked unconfirmed
    expect(verdict.state).toBe("met");
    expect(verdict.unconfirmed).toBe(false);
    expect(verdict.needs?.every((n) => n.state === "met")).toBe(true);
  });

  it("never returns met for a place without data", () => {
    // GIVEN a place with no attributes at all
    // WHEN it is checked against either preset
    // THEN the verdict is unknown, never met
    expect(mockVerdict({ attributes: [] }, wheelchair).state).toBe("unknown");
    expect(mockVerdict({ attributes: [] }, stroller).state).toBe("unknown");
  });

  it("never returns met when a needed attribute is in conflict", () => {
    // GIVEN an otherwise accessible place whose toilet data conflicts
    const place = {
      attributes: fullyAccessible.attributes.map((a) =>
        a.attribute === "toilet_accessible" ? { ...a, state: "conflict" as const, status: "conflict" as const, value: null } : a,
      ),
    };
    // WHEN it is checked
    const verdict = mockVerdict(place, wheelchair);
    // THEN the verdict is conflict and the toilet need says so
    expect(verdict.state).toBe("conflict");
    expect(verdict.needs?.find((n) => n.need === "toilet")?.state).toBe("conflict");
  });

  it("treats stale data as unknown, not as met", () => {
    // GIVEN the only door width is outdated
    const place = {
      attributes: fullyAccessible.attributes.map((a) =>
        a.attribute === "door_width_cm" ? { ...a, state: "stale" as const, status: "outdated" as const } : a,
      ),
    };
    // WHEN it is checked
    // THEN the verdict is unknown
    expect(mockVerdict(place, wheelchair).state).toBe("unknown");
  });

  it("applies the user's thresholds", () => {
    // GIVEN a 3 cm threshold and an 80 cm door
    const place = {
      attributes: [known("step_count", num(0)), known("threshold_cm", num(3)), known("door_width_cm", num(80))],
    };
    const entranceOnly = { ...wheelchair, requireLift: false, requireAccessibleToilet: false };
    const relaxed = { ...entranceOnly, maxThresholdCm: 3, minDoorWidthCm: 80 };
    // WHEN checked against the preset limits and against relaxed thresholds
    const strict = mockVerdict(place, entranceOnly);
    // THEN the presets block it with reasons, the relaxed thresholds accept it
    expect(strict.state).toBe("barrier");
    expect(strict.reasons).toEqual(["próg 3 cm", "drzwi 80 cm"]);
    expect(mockVerdict(place, relaxed).state).toBe("met");
  });

  it("accepts one step for the stroller preset but not for the wheelchair preset", () => {
    // GIVEN one step with a low threshold, and no ramp
    const place = {
      attributes: [known("step_count", num(1)), known("threshold_cm", num(2)), known("ramp", bool(false)), known("door_width_cm", num(90))],
    };
    const noFacilities = { requireLift: false, requireAccessibleToilet: false, requireChangingTable: false };
    // WHEN checked against both presets without facility needs
    // THEN the stroller preset accepts it and the wheelchair preset blocks it
    expect(mockVerdict(place, { ...stroller, ...noFacilities }).state).toBe("met");
    expect(mockVerdict(place, { ...wheelchair, ...noFacilities }).state).toBe("barrier");
  });

  it("never rates one step better than a step-free entrance when the threshold is unknown", () => {
    // GIVEN a step-free and a one-step entrance, both without threshold data
    const noFacilities = { ...stroller, requireLift: false, requireChangingTable: false };
    const stepFree = { attributes: [known("step_count", num(0)), known("door_width_cm", num(90))] };
    const oneStep = { attributes: [known("step_count", num(1)), known("door_width_cm", num(90))] };
    // WHEN checked against the stroller preset
    // THEN both are unknown on the threshold, neither is met
    for (const place of [stepFree, oneStep]) {
      const verdict = mockVerdict(place, noFacilities);
      expect(verdict.state).toBe("unknown");
      expect(verdict.unknowns).toEqual(["threshold_cm"]);
    }
  });

  it("treats steps with unknown ramp data as unknown, and a confirmed missing ramp as a barrier", () => {
    // GIVEN two steps, once without ramp data and once with no ramp
    const entranceOnly = { ...wheelchair, requireLift: false, requireAccessibleToilet: false };
    const noRampData = { attributes: [known("step_count", num(2)), known("door_width_cm", num(90))] };
    const noRamp = { attributes: [...noRampData.attributes, known("ramp", bool(false))] };
    // WHEN checked against the wheelchair preset
    const unknownRamp = mockVerdict(noRampData, entranceOnly);
    // THEN missing ramp data is unknown, a known lack of ramp blocks
    expect(unknownRamp.state).toBe("unknown");
    expect(unknownRamp.unknowns).toEqual(["ramp"]);
    expect(mockVerdict(noRamp, entranceOnly)).toMatchObject({ state: "barrier", reasons: ["2 stopnie"] });
  });

  it("never returns met when an attribute the profile doesn't need is in conflict", () => {
    // GIVEN a place that meets every wheelchair need but has conflicting surface data
    const place = {
      attributes: [
        ...fullyAccessible.attributes,
        { attribute: "surface" as const, state: "conflict" as const, status: "conflict" as const, value: null, facts: [] },
      ],
    };
    // WHEN checked against the wheelchair preset, which doesn't require a smooth surface
    const verdict = mockVerdict(place, wheelchair);
    // THEN the verdict is conflict with a reason, not met
    expect(verdict.state).toBe("conflict");
    expect(verdict.reasons).toEqual(["sprzeczne dane o miejscu"]);
  });

  it("marks met as unconfirmed when it rests on unverified data", () => {
    // GIVEN the lift is only known from community data
    const place = {
      attributes: fullyAccessible.attributes.map((a) => (a.attribute === "lift" ? { ...a, status: "unverified" as const } : a)),
    };
    // WHEN checked
    const verdict = mockVerdict(place, wheelchair);
    // THEN it is met but unconfirmed
    expect(verdict.state).toBe("met");
    expect(verdict.unconfirmed).toBe(true);
  });
});

describe("mock places API", () => {
  it("adds verdicts only when a profile is requested", () => {
    // GIVEN the spec examples
    // WHEN listing without and with a profile
    const plain = mockListPlaces();
    const withProfile = mockListPlaces({ profile: "wheelchair" });
    // THEN only the profiled list carries verdicts, and every example place is listed
    expect(plain.items.every((p) => p.verdict === null)).toBe(true);
    expect(withProfile.items.every((p) => p.verdict)).toBe(true);
    expect(withProfile.total).toBe(withProfile.items.length);
  });

  it("never gives the no-data and conflict examples a met verdict", () => {
    // GIVEN the demo cases from the spec
    // WHEN each is read with either profile
    for (const profile of ["wheelchair", "stroller"] as const) {
      // THEN neither is met
      expect(mockGetPlace("kawiarnia-przyklad", { profile })?.verdict?.state).not.toBe("met");
      expect(mockGetPlace("palac-krzysztofory", { profile })?.verdict?.state).not.toBe("met");
    }
  });

  it("matches the verdicts the spec examples document", () => {
    // GIVEN the examples written for the wheelchair presets
    // WHEN they are read with the wheelchair profile
    // THEN the mock agrees with the spec
    expect(mockGetPlace("hotel-przyklad", { profile: "wheelchair" })?.verdict).toMatchObject({ state: "met", unconfirmed: true });
    expect(mockGetPlace("restauracja-przyklad", { profile: "wheelchair" })?.verdict?.state).toBe("barrier");
  });

  it("filters by text ignoring Polish diacritics and keeps unknown ids out", () => {
    // GIVEN a query typed without diacritics
    // WHEN listing
    const result = mockListPlaces({ q: "palac" });
    // THEN Pałac Krzysztofory is found, and an unknown id is not
    expect(result.items.map((p) => p.id)).toEqual(["palac-krzysztofory"]);
    expect(mockGetPlace("nie-ma")).toBeNull();
  });
});
