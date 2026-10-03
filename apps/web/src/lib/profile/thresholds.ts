import type { Profile } from "@krakow-bez-barier/contracts";
import { PROFILE_PRESETS, type Thresholds } from "@/server/domain/profiles";

export type { Thresholds };

export const PROFILES = ["wheelchair", "stroller"] as const satisfies readonly Profile[];

export const THRESHOLD_LIMITS = {
  maxThresholdCm: { min: 0, max: 10, step: 1 },
  minDoorWidthCm: { min: 60, max: 120, step: 5 },
} as const;

export const DEFAULT_THRESHOLDS: Record<Profile, Thresholds> = PROFILE_PRESETS;

/** What we keep in the browser: the active profile (or none) and each profile's own thresholds. */
export interface ProfileSettings {
  profile: Profile | null;
  thresholds: Record<Profile, Thresholds>;
}

export const DEFAULT_SETTINGS: ProfileSettings = { profile: null, thresholds: DEFAULT_THRESHOLDS };

const isProfile = (value: unknown): value is Profile => PROFILES.includes(value as Profile);

function clamp(value: unknown, { min, max }: { min: number; max: number }, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function readThresholds(raw: unknown, fallback: Thresholds): Thresholds {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const flag = (key: keyof Thresholds) => (typeof value[key] === "boolean" ? (value[key] as boolean) : (fallback[key] as boolean));
  return {
    maxThresholdCm: clamp(value.maxThresholdCm, THRESHOLD_LIMITS.maxThresholdCm, fallback.maxThresholdCm),
    minDoorWidthCm: clamp(value.minDoorWidthCm, THRESHOLD_LIMITS.minDoorWidthCm, fallback.minDoorWidthCm),
    requireStepFree: flag("requireStepFree"),
    requireLift: flag("requireLift"),
    requireAccessibleToilet: flag("requireAccessibleToilet"),
    requireSmoothSurface: flag("requireSmoothSurface"),
    requireChangingTable: flag("requireChangingTable"),
  };
}

/** Parses what localStorage holds; anything missing or malformed falls back to the defaults. */
export function parseSettings(raw: string | null): ProfileSettings {
  if (!raw) return DEFAULT_SETTINGS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }
  const value = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const stored = (value.thresholds && typeof value.thresholds === "object" ? value.thresholds : {}) as Record<string, unknown>;
  return {
    profile: isProfile(value.profile) ? value.profile : null,
    thresholds: {
      wheelchair: readThresholds(stored.wheelchair, DEFAULT_THRESHOLDS.wheelchair),
      stroller: readThresholds(stored.stroller, DEFAULT_THRESHOLDS.stroller),
    },
  };
}

/** Query parameters for `listPlaces` / `getPlace`; empty when no profile is active. */
export function profileQuery(settings: ProfileSettings): { profile?: Profile } & Partial<Thresholds> {
  return settings.profile ? { profile: settings.profile, ...settings.thresholds[settings.profile] } : {};
}
