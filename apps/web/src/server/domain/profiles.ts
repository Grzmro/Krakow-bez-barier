import type { GetPlaceQuery, Profile } from "@krakow-bez-barier/contracts";

/** A profile's thresholds — exactly the query parameters the API takes next to `profile`. */
export type Thresholds = Required<
  Pick<
    GetPlaceQuery,
    | "maxThresholdCm"
    | "minDoorWidthCm"
    | "requireStepFree"
    | "requireLift"
    | "requireAccessibleToilet"
    | "requireSmoothSurface"
    | "requireChangingTable"
  >
>;

/**
 * Presets proposed in docs/requirements.md (US-2.1, US-2.2); users can change every value.
 * A new profile is a new entry here (plus the `Profile` enum in the spec) — no matcher change (US-2.8).
 */
export const PROFILE_PRESETS: Record<Profile, Thresholds> = {
  wheelchair: {
    maxThresholdCm: 2,
    minDoorWidthCm: 90,
    requireStepFree: true,
    requireLift: true,
    requireAccessibleToilet: true,
    requireSmoothSurface: false,
    requireChangingTable: false,
  },
  stroller: {
    maxThresholdCm: 3,
    minDoorWidthCm: 70,
    requireStepFree: false,
    requireLift: true,
    requireAccessibleToilet: false,
    requireSmoothSurface: false,
    requireChangingTable: true,
  },
};

/** The profile's presets overridden by whatever thresholds the request sends; `null` without a profile. */
export function thresholdsFor(query: GetPlaceQuery): Thresholds | null {
  if (!query.profile) return null;
  const preset = PROFILE_PRESETS[query.profile];
  return {
    maxThresholdCm: query.maxThresholdCm ?? preset.maxThresholdCm,
    minDoorWidthCm: query.minDoorWidthCm ?? preset.minDoorWidthCm,
    requireStepFree: query.requireStepFree ?? preset.requireStepFree,
    requireLift: query.requireLift ?? preset.requireLift,
    requireAccessibleToilet: query.requireAccessibleToilet ?? preset.requireAccessibleToilet,
    requireSmoothSurface: query.requireSmoothSurface ?? preset.requireSmoothSurface,
    requireChangingTable: query.requireChangingTable ?? preset.requireChangingTable,
  };
}
