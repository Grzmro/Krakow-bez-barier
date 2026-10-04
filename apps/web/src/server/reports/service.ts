import {
  reportRules,
  type AccessibilityAttribute,
  type Confirmation,
  type ConfirmationCreate,
  type Contribution,
  type FactValue,
  type ModerationDecision,
  type ModerationReport,
  type ModeratorSession,
  type PendingReport,
  type Report,
  type ReportCreate,
  type ReportStatus,
} from "@krakow-bez-barier/contracts";
import { createHash } from "node:crypto";
import { isStale, resolveAttribute, type AccessibilityFact } from "@/domain";
import { HttpError, type FieldError } from "@/server/http";
import { DEMO_REVERT_MINUTES } from "./demo";
import type { ModeratorPrincipal } from "./moderator-auth";
import type { ConfirmationRecord, ContributionRecord, NewFact, QueueCursor, ReportRecord, ReportsStore } from "./store";

export const REDACTED = "[usunięto]";
const MAX_TEXT_VALUE = 100;

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu;
// Runs of digits with separators; replaced only when they hold 9+ digits (a phone number, not "90 cm").
const DIGIT_RUN = /\+?\d[\d\s().-]{6,}\d/g;

/** Strips e-mail addresses and phone numbers from free text, so a report never stores contact data (R7). */
export function redactContactData(text: string): string {
  return text
    .replace(EMAIL, REDACTED)
    .replace(DIGIT_RUN, (run) => (run.replace(/\D/g, "").length >= 9 ? REDACTED : run));
}

function cleanComment(comment: string | null | undefined): string | null {
  const text = comment?.trim();
  return text ? redactContactData(text) : null;
}

const unprocessable = (detail: string, errors: FieldError[]) => new HttpError(422, { detail, errors });

/** Checks a reported value against the attribute (`ReportCreate.x-value-ranges`); returns it with its unit filled in. */
export function checkReportValue(attribute: AccessibilityAttribute, value: FactValue): FactValue {
  const range = reportRules.valueRanges[attribute];
  if (range) {
    if (value.kind !== "number") {
      throw unprocessable(`Attribute "${attribute}" requires a number.`, [{ field: "value.kind", message: "must be number" }]);
    }
    if (value.unit !== undefined && value.unit !== range.unit) {
      throw unprocessable(`Attribute "${attribute}" is measured in ${range.unit}.`, [
        { field: "value.unit", message: `must be ${range.unit}` },
      ]);
    }
    const outOfRange = value.number < range.min || value.number > range.max;
    if (outOfRange || (range.unit === "count" && !Number.isInteger(value.number))) {
      throw unprocessable(`Attribute "${attribute}" requires a number between ${range.min} and ${range.max}.`, [
        {
          field: "value.number",
          message: outOfRange ? `must be between ${range.min} and ${range.max}` : "must be a whole number",
        },
      ]);
    }
    return { ...value, unit: range.unit };
  }
  if (value.kind === "number") {
    throw unprocessable(`Attribute "${attribute}" does not take a number.`, [
      { field: "value.kind", message: "must be boolean or text" },
    ]);
  }
  if (value.kind === "text" && (value.text.trim() === "" || value.text.length > MAX_TEXT_VALUE)) {
    throw unprocessable(`The value must be 1–${MAX_TEXT_VALUE} characters long.`, [
      { field: "value.text", message: `must be 1–${MAX_TEXT_VALUE} characters` },
    ]);
  }
  return value;
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function toReport(record: ReportRecord): Report {
  return {
    id: record.id,
    placeId: record.placeId,
    attribute: record.attribute,
    value: record.value,
    comment: record.comment,
    photoUrl: record.photoUrl,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    decidedAt: iso(record.decidedAt),
  };
}

async function requirePlace(store: ReportsStore, ref: string) {
  const place = await store.findPlace(ref);
  if (!place) throw new HttpError(404, { detail: `Place "${ref}" does not exist.` });
  return place;
}

/**
 * The stored form of a browser's contributor token: its SHA-256, so the database never holds a token that could be
 * replayed. The token itself is random (no account, IP or fingerprint behind it, R7).
 */
export function contributorHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Stores a report. With a contributor token the device keeps one pending contribution per place and attribute:
 * its pending report of the attribute is replaced (`replaced: true`, same id) and its confirmation withdrawn.
 */
export async function submitReport(
  store: ReportsStore,
  body: ReportCreate,
  contributorToken?: string,
  now: Date = new Date(),
): Promise<{ report: Report; replaced: boolean }> {
  if (body.website) {
    throw unprocessable("The report could not be accepted.", [{ field: "website", message: "must be empty" }]);
  }
  if (body.photoUrl) {
    throw unprocessable("Photo upload is not available yet.", [{ field: "photoUrl", message: "must be null" }]);
  }
  const value = checkReportValue(body.attribute, body.value);
  const place = await requirePlace(store, body.placeId);
  const report = { placeId: place.id, attribute: body.attribute, value, comment: cleanComment(body.comment) };
  if (!contributorToken) return { report: toReport(await store.insertReport(report)), replaced: false };
  const saved = await store.saveContributorReport({ ...report, contributor: contributorHash(contributorToken), at: now });
  return { report: toReport(saved.report), replaced: saved.replaced };
}

export async function createReport(store: ReportsStore, body: ReportCreate): Promise<Report> {
  return (await submitReport(store, body)).report;
}

const toConfirmation = (record: ConfirmationRecord): Confirmation => ({
  id: record.id,
  placeId: record.placeId,
  factId: record.factId,
  comment: record.comment,
  createdAt: record.createdAt.toISOString(),
});

/**
 * Records a confirmation. `admit` runs only when a new confirmation would be stored (throw to refuse, e.g. a rate
 * limit). With a contributor token, a fact the device already confirmed returns that confirmation (`created: false`);
 * otherwise the device's pending report and other confirmations of the attribute are withdrawn — the latest wins.
 */
export async function submitConfirmation(
  store: ReportsStore,
  placeRef: string,
  body: ConfirmationCreate,
  options: { contributorToken?: string; admit?: () => void; now?: Date } = {},
): Promise<{ confirmation: Confirmation; created: boolean }> {
  const { contributorToken, admit = () => {}, now = new Date() } = options;
  const place = await requirePlace(store, placeRef);
  const fact = await store.findActiveFact(place.id, body.factId);
  if (!fact) throw new HttpError(404, { detail: `Place "${placeRef}" has no current fact "${body.factId}".` });
  const comment = cleanComment(body.comment);
  if (!contributorToken) {
    admit();
    const record = await store.confirmFact({ placeId: place.id, factId: fact.id, comment, at: now });
    return { confirmation: toConfirmation(record), created: true };
  }
  const result = await store.confirmFactAsContributor({
    placeId: place.id,
    factId: fact.id,
    attribute: fact.attribute,
    comment,
    at: now,
    contributor: contributorHash(contributorToken),
    admit,
  });
  return { confirmation: toConfirmation(result.confirmation), created: result.created };
}

export async function createConfirmation(
  store: ReportsStore,
  placeRef: string,
  body: ConfirmationCreate,
  now: Date = new Date(),
): Promise<Confirmation> {
  return (await submitConfirmation(store, placeRef, body, { now })).confirmation;
}

/** What the device has sent for the place and is still pending: at most one item per attribute, the latest. */
export async function listContributions(store: ReportsStore, placeRef: string, contributorToken: string): Promise<Contribution[]> {
  const place = await requirePlace(store, placeRef);
  const records = await store.listContributions(place.id, contributorHash(contributorToken));
  const latest = new Map<AccessibilityAttribute, ContributionRecord>();
  for (const record of records) {
    const seen = latest.get(record.attribute);
    if (!seen || record.createdAt > seen.createdAt) latest.set(record.attribute, record);
  }
  return [...latest.values()].map((record) => ({ ...record, createdAt: record.createdAt.toISOString() }));
}

export async function withdrawContribution(
  store: ReportsStore,
  placeRef: string,
  attribute: AccessibilityAttribute,
  contributorToken: string,
  now: Date = new Date(),
): Promise<void> {
  const place = await requirePlace(store, placeRef);
  await store.withdrawContributions({ placeId: place.id, attribute, contributor: contributorHash(contributorToken), at: now });
}

export function encodeCursor(cursor: QueueCursor): string {
  return Buffer.from(JSON.stringify([cursor.createdAt.toISOString(), cursor.id])).toString("base64url");
}

export function decodeCursor(cursor: string): QueueCursor {
  try {
    const [createdAt, id] = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown[];
    const date = new Date(String(createdAt));
    if (typeof id === "string" && !Number.isNaN(date.getTime())) return { createdAt: date, id };
  } catch {
    // fall through to the 400 below
  }
  throw new HttpError(400, { detail: "Invalid cursor.", errors: [{ field: "query.cursor", message: "is not a cursor from this API" }] });
}

/** The value the card shows now for the attribute, with the source and date of the fact it comes from. */
export function currentOf(
  attribute: AccessibilityAttribute,
  facts: AccessibilityFact[],
  now: Date,
): Pick<ModerationReport, "currentValue" | "currentSource" | "currentConfirmations"> {
  const resolved = resolveAttribute(attribute, facts, now);
  if (!resolved.value) return { currentValue: null, currentSource: null, currentConfirmations: null };
  // The resolver decides on fresh facts first; all of them agree here, so the first fresh one is the value's source.
  const shown = resolved.facts.find((f) => !isStale(f, now)) ?? resolved.facts[0];
  return {
    currentValue: resolved.value,
    currentSource: { name: shown.source.name, asOf: shown.confirmedAt ?? shown.observedAt ?? shown.fetchedAt },
    currentConfirmations: {
      count: shown.evidence?.confirmations ?? 0,
      lastAt: shown.evidence?.confirmationDates?.[0] ?? null,
    },
  };
}

export async function listModerationQueue(
  store: ReportsStore,
  query: { status?: ReportStatus; limit: number; cursor?: string },
  now: Date = new Date(),
): Promise<{ items: ModerationReport[]; nextCursor: string | null }> {
  const after = query.cursor ? decodeCursor(query.cursor) : undefined;
  const rows = await store.listQueue({ status: query.status, limit: query.limit + 1, after });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map(({ report, placeName, currentFacts, history }) => ({
      ...toReport(report),
      placeName,
      ...currentOf(report.attribute, currentFacts, now),
      history: history.map((event) => ({
        decision: event.decision,
        note: event.note,
        moderator: event.moderator,
        decidedAt: event.createdAt.toISOString(),
      })),
    })),
    nextCursor: rows.length > query.limit && last ? encodeCursor({ createdAt: last.report.createdAt, id: last.report.id }) : null,
  };
}

/** The fact an accepted report becomes: one per place and attribute for the moderated community source. */
export function factFromReport(report: ReportRecord, at: Date): NewFact {
  return {
    placeId: report.placeId,
    attribute: report.attribute,
    value: report.value,
    unit: report.value.kind === "number" ? (report.value.unit ?? null) : null,
    sourceRecordRef: `place:${report.placeId}`,
    fetchedAt: at,
    observedAt: report.createdAt,
    confirmedAt: at,
    comment: report.comment,
    photoUrl: report.photoUrl,
  };
}

/** The signed-in moderator as the queue response describes it. */
export function moderatorSession(moderator: ModeratorPrincipal): ModeratorSession {
  return { name: moderator.name, demo: moderator.demo, revertsAfterMinutes: moderator.demo ? DEMO_REVERT_MINUTES : null };
}

export async function decideReport(
  store: ReportsStore,
  body: ModerationDecision,
  moderator: ModeratorPrincipal,
  now: Date = new Date(),
): Promise<Report> {
  const result = await store.decide({
    reportId: body.reportId,
    decision: body.decision,
    note: body.note?.trim() || null,
    moderator: moderator.name,
    demo: moderator.demo,
    at: now,
    toFact: (report) => factFromReport(report, now),
  });
  if (result.kind === "not_found") throw new HttpError(404, { detail: `Report "${body.reportId}" does not exist.` });
  if (result.kind === "final") {
    throw new HttpError(409, { detail: `Report "${body.reportId}" is already ${result.status}.` });
  }
  return toReport(result.report);
}

/**
 * Reports awaiting moderation for one place, grouped by attribute, in the shape of
 * `ResolvedAttribute.pendingReports` — the places API lists them beside the value as unverified.
 */
export async function pendingReportsByAttribute(
  store: ReportsStore,
  placeId: string,
): Promise<Map<AccessibilityAttribute, PendingReport[]>> {
  const grouped = new Map<AccessibilityAttribute, PendingReport[]>();
  for (const report of await store.listPending(placeId)) {
    if (report.status !== "new" && report.status !== "needs_info") continue;
    const list = grouped.get(report.attribute) ?? [];
    list.push({
      id: report.id,
      value: report.value,
      comment: report.comment,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    });
    grouped.set(report.attribute, list);
  }
  return grouped;
}
