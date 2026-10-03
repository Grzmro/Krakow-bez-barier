import type {
  AccessibilityAttribute,
  AccessibilityFact,
  FactValue,
  ModerationDecisionKind,
  ReportStatus,
} from "@krakow-bez-barier/contracts";

/** A stored report. Holds no personal data: no account, e-mail, IP or user agent (R7). */
export type ReportRecord = {
  id: string;
  placeId: string;
  attribute: AccessibilityAttribute;
  value: FactValue;
  comment: string | null;
  photoUrl: string | null;
  status: ReportStatus;
  createdAt: Date;
  decidedAt: Date | null;
};

export type NewReport = Pick<ReportRecord, "placeId" | "attribute" | "value" | "comment">;

export type ModerationEventRecord = {
  decision: ModerationDecisionKind;
  note: string | null;
  moderator: string;
  createdAt: Date;
};

export type QueueItem = {
  report: ReportRecord;
  placeName: string;
  /** Active facts of the report's place and attribute, to show what the card says now. */
  currentFacts: AccessibilityFact[];
  history: ModerationEventRecord[];
};

export type QueueCursor = { createdAt: Date; id: string };

export type NewFact = {
  placeId: string;
  attribute: AccessibilityAttribute;
  value: FactValue;
  unit: string | null;
  sourceRecordRef: string;
  fetchedAt: Date;
  observedAt: Date;
  confirmedAt: Date;
  comment: string | null;
  photoUrl: string | null;
};

export type Decision = {
  reportId: string;
  decision: ModerationDecisionKind;
  note: string | null;
  moderator: string;
  /** The demo account: an accepted report becomes a fact from `DEMO_MODERATED_SOURCE` instead of the real one. */
  demo: boolean;
  at: Date;
  /** Builds the fact an accepted report becomes; written in the same transaction. */
  toFact: (report: ReportRecord) => NewFact;
};

export type DecisionResult =
  | { kind: "decided"; report: ReportRecord }
  | { kind: "not_found" }
  | { kind: "final"; status: ReportStatus };

export type ConfirmationRecord = {
  id: string;
  placeId: string;
  factId: string;
  comment: string | null;
  createdAt: Date;
};

/** Persistence for reports, confirmations and moderation; `drizzle-store.ts` in the app, a fake in tests. */
export interface ReportsStore {
  /** Finds a place by its id or external reference (e.g. `osm:node/123`). */
  findPlace(ref: string): Promise<{ id: string; name: string } | null>;
  insertReport(report: NewReport): Promise<ReportRecord>;
  /** The place's active fact with this id, or null. */
  findActiveFact(placeId: string, factId: string): Promise<{ id: string } | null>;
  /**
   * Records a confirmation and, atomically, sets the fact's `confirmedAt` and `evidence.confirmations` to the
   * total number of confirmations.
   */
  confirmFact(input: { placeId: string; factId: string; comment: string | null; at: Date }): Promise<ConfirmationRecord>;
  /** Reports ordered by `createdAt`, then `id`, starting after `after`; at most `limit`. */
  listQueue(input: { status?: ReportStatus; limit: number; after?: QueueCursor }): Promise<QueueItem[]>;
  decide(decision: Decision): Promise<DecisionResult>;
  /** Reports of a place still awaiting a final decision (`new`, `needs_info`), oldest first. */
  listPending(placeId: string): Promise<ReportRecord[]>;
  /**
   * Undoes `moderator`'s decisions made before `before`, atomically: removes them from the history, sets each report's
   * status back to what its remaining history says (`new` when none is left) and deletes the facts from
   * `DEMO_MODERATED_SOURCE` fetched before `before`, with their confirmations. Returns how many decisions it undid.
   */
  revertDemoDecisions(input: { moderator: string; before: Date }): Promise<number>;
}
