import type { OutageEquipment, OutageVote } from "@krakow-bez-barier/contracts";
import type { OutageRecord } from "@/domain/outages";

export type ReportOutageInput = {
  placeId: string;
  equipment: OutageEquipment;
  at: Date;
  /** Whether a stored outage still counts; decided by the domain rules, under the store's lock. */
  isActive: (record: OutageRecord) => boolean;
  /** Whether this client may still confirm an existing outage (one confirmation per outage per client). */
  mayConfirm: (outageId: string) => boolean;
};

export type ReportOutageResult = { record: OutageRecord; created: boolean; confirmed: boolean };

export type VoteInput = {
  placeId: string;
  outageId: string;
  vote: OutageVote;
  at: Date;
  isActive: (record: OutageRecord) => boolean;
};

export type VoteResult = { kind: "voted"; record: OutageRecord } | { kind: "not_found" } | { kind: "inactive"; record: OutageRecord };

/** An outage with the name of its place, for the moderator's list. */
export type PlacedOutageRecord = OutageRecord & { placeName: string };

export type RemoveInput = {
  outageId: string;
  /** Moderator name, kept with the removal. */
  moderator: string;
  at: Date;
  /** When the removal stops counting (the demo account's); `null` for a lasting one. */
  endsAt: Date | null;
  isActive: (record: OutageRecord) => boolean;
};

export type RemoveResult =
  | { kind: "removed"; record: PlacedOutageRecord }
  | { kind: "not_found" }
  | { kind: "inactive"; record: OutageRecord };

/** Persistence for outages and their votes; `drizzle-store.ts` in the app, `memory-store.ts` in tests. */
export interface OutagesStore {
  /** Finds a place by its id or external reference (e.g. `osm:node/123`). */
  findPlace(ref: string): Promise<{ id: string } | null>;
  /**
   * Atomically, per place and equipment: opens a new outage, or — when the latest one of this equipment is still
   * active — adds a `still_broken` vote to it (if `mayConfirm`) instead of opening a second one.
   */
  report(input: ReportOutageInput): Promise<ReportOutageResult>;
  /** Adds a vote to the place's outage if it is still active, checked under the same lock as `report`. */
  vote(input: VoteInput): Promise<VoteResult>;
  /** Outages of these places reported or confirmed at or after `since`, with their votes counted. */
  listRecent(placeIds: string[], since: Date): Promise<OutageRecord[]>;
  /** Outages of every place reported or confirmed at or after `since`, newest first, with their place names. */
  listRecentEverywhere(since: Date): Promise<PlacedOutageRecord[]>;
  /** Marks an outage removed by a moderator if it is still active, under the same lock as `report` and `vote`. */
  remove(input: RemoveInput): Promise<RemoveResult>;
}
