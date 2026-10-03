import type { AccessibilityAttribute, GetPlaceQuery, Need, Profile } from "@krakow-bez-barier/contracts";

type ThresholdKey = Exclude<keyof GetPlaceQuery, "profile">;

/** How the matcher checks one optional need: presence of a facility, or a need with its own rule. */
export type NeedRule = "facility" | "lift" | "surface";

/**
 * Needs a profile can switch on, in the order verdicts list them. A need answered by "is this facility
 * there?" is one row with `rule: "facility"` and needs no matcher change; its flag must be a query
 * parameter in the spec and its need a `Need` value.
 */
export const OPTIONAL_NEEDS = [
  { flag: "requireLift", need: "lift", attribute: "lift", rule: "lift" },
  { flag: "requireAccessibleToilet", need: "toilet", attribute: "toilet_accessible", rule: "facility" },
  { flag: "requireSmoothSurface", need: "surface", attribute: "surface", rule: "surface" },
  { flag: "requireChangingTable", need: "changing_table", attribute: "changing_table", rule: "facility" },
  { flag: "requireBench", need: "bench", attribute: "bench", rule: "facility" },
] as const satisfies readonly { flag: ThresholdKey; need: Need; attribute: AccessibilityAttribute; rule: NeedRule }[];

/** Every on/off setting of a profile: the entrance's step-free switch and one flag per optional need. */
export const THRESHOLD_FLAGS = ["requireStepFree", ...OPTIONAL_NEEDS.map((n) => n.flag)] as const;

export type ThresholdFlag = (typeof THRESHOLD_FLAGS)[number];

/** A profile's thresholds — exactly the query parameters the API takes next to `profile`. */
export type Thresholds = Required<Pick<GetPlaceQuery, "maxThresholdCm" | "minDoorWidthCm" | ThresholdFlag>>;

/**
 * Presets proposed in docs/requirements.md (US-2.1, US-2.2); users can change every value. A new profile
 * needs no matcher change: an entry here (which also makes it selectable), its `Profile` value in the spec,
 * and its `profileName` / `switch.short` labels in `i18n/pl/profile.ts` and `i18n/en/profile.ts` — the compiler
 * flags each one missing.
 * A new facility need is one `OPTIONAL_NEEDS` row.
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
    requireBench: false,
  },
  stroller: {
    maxThresholdCm: 3,
    minDoorWidthCm: 70,
    requireStepFree: false,
    requireLift: true,
    requireAccessibleToilet: false,
    requireSmoothSurface: false,
    requireChangingTable: true,
    requireBench: false,
  },
};

/** The profile's presets overridden by whatever thresholds the request sends; `null` without a profile. */
export function thresholdsFor(query: GetPlaceQuery): Thresholds | null {
  if (!query.profile) return null;
  const preset = PROFILE_PRESETS[query.profile];
  const thresholds: Thresholds = {
    ...preset,
    maxThresholdCm: query.maxThresholdCm ?? preset.maxThresholdCm,
    minDoorWidthCm: query.minDoorWidthCm ?? preset.minDoorWidthCm,
  };
  for (const flag of THRESHOLD_FLAGS) thresholds[flag] = query[flag] ?? preset[flag];
  return thresholds;
}
