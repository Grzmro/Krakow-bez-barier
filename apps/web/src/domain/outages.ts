import { outageRules, type Outage, type OutageEquipment, type OutageRules, type OutageState } from "@krakow-bez-barier/contracts";

/** A stored outage with its votes counted; the state is derived from these and the time, never stored. */
export type OutageRecord = {
  id: string;
  placeId: string;
  equipment: OutageEquipment;
  reportedAt: Date;
  /** Confirmations after the first report. */
  confirmations: number;
  /** The latest report or confirmation; `reportedAt` without confirmations. */
  lastConfirmedAt: Date;
  workingVotes: number;
};

const HOUR_MS = 3_600_000;

// Keyed by the spec's enum, so a new kind of equipment fails the build here until it is handled.
const EQUIPMENT: Record<OutageEquipment, true> = { lift: true, ramp: true };

/** Whether visitors can report an outage of this attribute (a lift or a ramp). */
export const isOutageEquipment = (attribute: string): attribute is OutageEquipment => Object.hasOwn(EQUIPMENT, attribute);

export function outageExpiresAt(record: OutageRecord, rules: OutageRules = outageRules): Date {
  return new Date(record.lastConfirmedAt.getTime() + rules.expiresAfterHours * HOUR_MS);
}

/** "Działa" wins over confirmations; an outage nobody confirms for `expiresAfterHours` expires. */
export function outageState(record: OutageRecord, now: Date, rules: OutageRules = outageRules): OutageState {
  if (record.workingVotes >= rules.workingVotesToResolve) return "resolved";
  if (now.getTime() >= outageExpiresAt(record, rules).getTime()) return "expired";
  return record.confirmations >= rules.confirmationsToConfirm ? "confirmed" : "reported";
}

export const isActiveOutage = (outage: Pick<Outage, "state">) => outage.state === "reported" || outage.state === "confirmed";

export function toOutage(record: OutageRecord, now: Date, rules: OutageRules = outageRules): Outage {
  return {
    id: record.id,
    equipment: record.equipment,
    state: outageState(record, now, rules),
    confirmations: record.confirmations,
    workingVotes: record.workingVotes,
    reportedAt: record.reportedAt.toISOString(),
    lastConfirmedAt: record.lastConfirmedAt.toISOString(),
    expiresAt: outageExpiresAt(record, rules).toISOString(),
  };
}

/** The outages a place card lists and verdicts count: active ones only, newest first. */
export function activeOutages(records: OutageRecord[], now: Date, rules: OutageRules = outageRules): Outage[] {
  return records
    .map((record) => toOutage(record, now, rules))
    .filter(isActiveOutage)
    .sort((a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt) || (a.id < b.id ? -1 : 1));
}
