import { outageRules } from "./generated/outage-rules";

/** Thresholds of community outage reports (`reportOutage` → `x-outage-rules` in openapi.yaml). */
export type OutageRules = {
  /** Confirmations after the first report that make an outage `confirmed`. */
  confirmationsToConfirm: number;
  /** "Działa" votes that make an outage `resolved`. */
  workingVotesToResolve: number;
  /** Hours without a confirmation after which an outage is `expired`. */
  expiresAfterHours: number;
};

export { outageRules };
