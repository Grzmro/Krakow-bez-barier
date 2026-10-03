import type { Reliability } from "@krakow-bez-barier/contracts";

/** What a fleet entry is: a fact about the vehicle's model, or the carrier's own announcement. */
export type FleetEntryKind = "fleet_type" | "carrier_declaration";

/** Where a fleet entry comes from; its licence goes through the same gate as every other source (R3). */
export type FleetSource = { name: string; license: string; licenseConfirmed: boolean };

/** Vehicles of one feed sharing a model, picked by fleet number (`VehicleDescriptor.label`). */
export type FleetEntry = {
  feedId: string;
  /** Fleet numbers: an explicit list or an inclusive numeric range. */
  labels: string[] | { from: number; to: number };
  /** Model name, or the declaration's wording ("niskopodłogowe od 2019"). */
  model: string;
  lowFloor: boolean;
  kind: FleetEntryKind;
  source: FleetSource;
};

/** A carrier's declaration is not a check of the vehicle, so it ranks below a fact about the model. */
export const FLEET_RELIABILITY: Record<FleetEntryKind, Reliability> = {
  fleet_type: "extracted",
  carrier_declaration: "inferred",
};

/**
 * Kraków's fleet types (city configuration, not code logic). Empty until a source with a confirmed licence is added:
 * ZTP and MPK publish no fleet register under an open licence, so no entry is invented here and every vehicle is judged
 * by the operator's flag alone.
 * TODO(KBB-93): fill from MPK's fleet list / low-floor declaration once its licence is checked.
 */
export const KRAKOW_FLEET: FleetEntry[] = [];

const matches = (labels: FleetEntry["labels"], label: string) => {
  if (Array.isArray(labels)) return labels.includes(label);
  const n = Number(label);
  return /^\d+$/.test(label) && n >= labels.from && n <= labels.to;
};

/** The entries describing the vehicle `label` of `feedId` that may be used: licence confirmed, or outside production. */
export function fleetEntriesFor(
  fleet: FleetEntry[],
  feedId: string,
  label: string | undefined,
  { production }: { production: boolean },
): FleetEntry[] {
  if (!label) return [];
  return fleet.filter(
    (e) => e.feedId === feedId && matches(e.labels, label) && (e.source.licenseConfirmed || !production),
  );
}
