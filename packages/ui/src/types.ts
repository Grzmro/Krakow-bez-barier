/** Verdict of one user need (or a whole place) against the data we have. */
export type Status = "met" | "barrier" | "conflict" | "unknown";

/** How far a shown fact can be trusted, as displayed to the user. */
export type Reliability = "confirmed" | "unverified" | "outdated" | "conflict" | "unknown";

export const STATUSES = ["met", "barrier", "conflict", "unknown"] as const satisfies readonly Status[];

export const RELIABILITIES = [
  "confirmed",
  "unverified",
  "outdated",
  "conflict",
  "unknown",
] as const satisfies readonly Reliability[];
