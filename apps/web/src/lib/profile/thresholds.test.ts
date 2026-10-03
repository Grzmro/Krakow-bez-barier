import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, DEFAULT_THRESHOLDS, parseSettings, profileQuery } from "./thresholds";

describe("parseSettings", () => {
  it("falls back to no profile and the presets for empty or broken storage", () => {
    // GIVEN nothing stored, or garbage
    // WHEN parsed
    // THEN the defaults are used — the app never requires a profile
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ profile: "senior" })).profile).toBeNull();
  });

  it("keeps valid values, clamps numbers and fills missing ones from the preset", () => {
    // GIVEN a stored stroller profile with an out-of-range threshold, a malformed flag and a missing one
    const raw = JSON.stringify({
      profile: "stroller",
      thresholds: { stroller: { maxThresholdCm: 99, minDoorWidthCm: 75, requireLift: false, requireBench: true, requireStepFree: "yes" } },
    });
    // WHEN parsed
    const settings = parseSettings(raw);
    // THEN valid values survive, the threshold is clamped and the rest come from the preset
    expect(settings.profile).toBe("stroller");
    expect(settings.thresholds.stroller).toEqual({
      ...DEFAULT_THRESHOLDS.stroller,
      maxThresholdCm: 10,
      minDoorWidthCm: 75,
      requireLift: false,
      requireBench: true,
    });
    expect(settings.thresholds.wheelchair).toEqual(DEFAULT_THRESHOLDS.wheelchair);
  });
});

describe("profileQuery", () => {
  it("sends nothing without a profile and the active profile's thresholds with one", () => {
    // GIVEN settings with and without an active profile
    // WHEN turned into query parameters
    // THEN only an active profile adds parameters
    expect(profileQuery(DEFAULT_SETTINGS)).toEqual({});
    expect(profileQuery({ ...DEFAULT_SETTINGS, profile: "wheelchair" })).toEqual({
      profile: "wheelchair",
      ...DEFAULT_THRESHOLDS.wheelchair,
    });
  });
});
