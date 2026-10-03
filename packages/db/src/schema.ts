import type {
  AccessibilityAttribute,
  Category,
  FactStatus,
  FactValue,
  OutageEquipment,
  OutageVote,
  Reliability,
  ReportStatus,
  SourceKind,
  SourceRefreshStatus,
} from "@krakow-bez-barier/contracts";
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export type LonLat = { x: number; y: number };

// drizzle's geometry() drops the SRID from the DDL; spell it out so the column is geometry(Point,4326).
const point4326 = customType<{ data: LonLat; driverData: string }>({
  dataType: () => "geometry(Point,4326)",
  toDriver: ({ x, y }) => `SRID=4326;POINT(${x} ${y})`,
  fromDriver: (hex) => {
    const b = Buffer.from(hex, "hex");
    const le = b[0] === 1;
    const type = le ? b.readUInt32LE(1) : b.readUInt32BE(1);
    const offset = type & 0x20000000 ? 9 : 5;
    return le
      ? { x: b.readDoubleLE(offset), y: b.readDoubleLE(offset + 8) }
      : { x: b.readDoubleBE(offset), y: b.readDoubleBE(offset + 8) };
  },
});

export type FactEvidence = {
  photoUrl?: string | null;
  comment?: string | null;
  /** The page the fact was read from, e.g. a BIP document. */
  url?: string | null;
  /** Number of anonymous "still true" confirmations. */
  confirmations?: number;
};

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").$type<SourceKind>().notNull(),
  license: text("license").notNull(),
  termsUrl: text("terms_url"),
  attribution: text("attribution"),
  url: text("url"),
  refreshInterval: text("refresh_interval"),
  baseReliability: text("base_reliability").$type<Reliability>().notNull(),
  refreshStatus: text("refresh_status").$type<SourceRefreshStatus>().notNull().default("never"),
  lastSuccessAt: timestamptz("last_success_at"),
  lastAttemptAt: timestamptz("last_attempt_at"),
  statusNote: text("status_note"),
  isSample: boolean("is_sample").notNull().default(false),
});

export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalRef: text("external_ref").unique(),
    name: text("name").notNull(),
    category: text("category").$type<Category>().notNull(),
    location: point4326("location").notNull(),
    street: text("street"),
    houseNumber: text("house_number"),
    postalCode: text("postal_code"),
    city: text("city").notNull().default("Kraków"),
    phone: text("phone"),
    website: text("website"),
    email: text("email"),
    entranceHint: text("entrance_hint"),
    isSample: boolean("is_sample").notNull().default(false),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [index("places_location_gist").using("gist", t.location), index("places_category_idx").on(t.category)],
);

export const facts = pgTable(
  "facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id),
    subject: text("subject").notNull().default("place"),
    attribute: text("attribute").$type<AccessibilityAttribute>().notNull(),
    value: jsonb("value").$type<FactValue>().notNull(),
    unit: text("unit"),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    sourceRecordRef: text("source_record_ref").notNull().default(""),
    fetchedAt: timestamptz("fetched_at").notNull(),
    observedAt: timestamptz("observed_at"),
    confirmedAt: timestamptz("confirmed_at"),
    reliability: text("reliability").$type<Reliability>().notNull(),
    evidence: jsonb("evidence").$type<FactEvidence>(),
    status: text("status").$type<FactStatus>().notNull().default("active"),
    supersededAt: timestamptz("superseded_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("facts_active_unique")
      .on(t.sourceId, t.sourceRecordRef, t.subject, t.attribute)
      .where(sql`${t.status} = 'active'`),
    index("facts_place_idx").on(t.placeId, t.attribute),
  ],
);

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    startedAt: timestamptz("started_at").notNull().defaultNow(),
    finishedAt: timestamptz("finished_at"),
    status: text("status").$type<"ok" | "partial" | "failed">().notNull(),
    recordsSeen: integer("records_seen").notNull().default(0),
    recordsWritten: integer("records_written").notNull().default(0),
    recordsSkipped: integer("records_skipped").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("ingestion_runs_source_idx").on(t.sourceId, t.startedAt)],
);

// No e-mail, IP, user agent or account reference — reports are anonymous (R7).
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id),
    attribute: text("attribute").$type<AccessibilityAttribute>().notNull(),
    value: jsonb("value").$type<FactValue>().notNull(),
    comment: text("comment"),
    photoUrl: text("photo_url"),
    status: text("status").$type<ReportStatus>().notNull().default("new"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    decidedAt: timestamptz("decided_at"),
  },
  (t) => [index("reports_status_idx").on(t.status, t.createdAt)],
);

export const confirmations = pgTable(
  "confirmations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id),
    factId: uuid("fact_id")
      .notNull()
      .references(() => facts.id),
    comment: text("comment"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("confirmations_fact_idx").on(t.factId)],
);

export const moderationLog = pgTable("moderation_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reports.id),
  decision: text("decision").$type<Exclude<ReportStatus, "new">>().notNull(),
  note: text("note"),
  // Moderator name from server config; reporters stay anonymous.
  moderator: text("moderator").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

// A temporary outage of a place's equipment, reported by visitors. Its state (reported, confirmed, resolved, expired)
// is derived from the votes and the time when read, so nothing has to expire it. Anonymous like reports (R7).
export const outages = pgTable(
  "outages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id),
    equipment: text("equipment").$type<OutageEquipment>().notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    // Taken down by a moderator as false or spam; kept, not deleted. A removal with an end time (the demo
    // account's) stops counting at `removal_ends_at`.
    removedAt: timestamptz("removed_at"),
    removedBy: text("removed_by"),
    removalEndsAt: timestamptz("removal_ends_at"),
  },
  (t) => [index("outages_place_idx").on(t.placeId, t.equipment, t.createdAt)],
);

export const outageVotes = pgTable(
  "outage_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    outageId: uuid("outage_id")
      .notNull()
      .references(() => outages.id),
    vote: text("vote").$type<OutageVote>().notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("outage_votes_outage_idx").on(t.outageId)],
);
