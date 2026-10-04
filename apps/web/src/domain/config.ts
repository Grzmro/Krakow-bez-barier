import type { Reliability } from "./types";

export const STALE_AFTER_MONTHS = 12;

export const COMMUNITY_CONFIRMATIONS_REQUIRED = 2;

/** Only confirmations this recent count: a value nobody has vouched for lately is not "confirmed". */
export const CONFIRMATION_WINDOW_DAYS = 90;

export const RELIABILITY_RANK: Record<Reliability, number> = {
  confirmed: 5,
  community: 4,
  extracted: 3,
  user_report: 2,
  inferred: 1,
  sample: 0,
};
