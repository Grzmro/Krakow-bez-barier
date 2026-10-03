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
    // GIVEN one step and no ramp data
    const place = { attributes: [known("step_count", num(1)), known("door_width_cm", num(90))] };
    const noFacilities = { requireLift: false, requireAccessibleToilet: false, requireChangingTable: false };
    // WHEN checked against both presets without facility needs
    // THEN the stroller preset accepts it and the wheelchair preset blocks it
    expect(mockVerdict(place, { ...stroller, ...noFacilities }).state).toBe("met");
    expect(mockVerdict(place, { ...wheelchair, ...noFacilities }).state).toBe("barrier");
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
