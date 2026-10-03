import {
  reportRules,
  type AccessibilityAttribute,
  type Confirmation,
  type ConfirmationCreate,
  type FactValue,
  type ModerationDecision,
  type ModerationReport,
  type PendingReport,
  type Report,
  type ReportCreate,
  type ReportStatus,
} from "@krakow-bez-barier/contracts";
import { resolveAttribute } from "@/server/domain";
import { HttpError, type FieldError } from "@/server/http";
import type { NewFact, QueueCursor, ReportRecord, ReportsStore } from "./store";

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

export async function createReport(store: ReportsStore, body: ReportCreate): Promise<Report> {
  if (body.website) {
    throw unprocessable("The report could not be accepted.", [{ field: "website", message: "must be empty" }]);
  }
  if (body.photoUrl) {
    throw unprocessable("Photo upload is not available yet.", [{ field: "photoUrl", message: "must be null" }]);
  }
  const value = checkReportValue(body.attribute, body.value);
  const place = await requirePlace(store, body.placeId);
  const record = await store.insertReport({
    placeId: place.id,
    attribute: body.attribute,
    value,
    comment: cleanComment(body.comment),
  });
  return toReport(record);
}

export async function createConfirmation(
  store: ReportsStore,
  placeRef: string,
  body: ConfirmationCreate,
  now: Date = new Date(),
): Promise<Confirmation> {
  const place = await requirePlace(store, placeRef);
  const fact = await store.findActiveFact(place.id, body.factId);
  if (!fact) throw new HttpError(404, { detail: `Place "${placeRef}" has no current fact "${body.factId}".` });
  const record = await store.confirmFact({ placeId: place.id, factId: fact.id, comment: cleanComment(body.comment), at: now });
  return {
    id: record.id,
    placeId: record.placeId,
    factId: record.factId,
    comment: record.comment,
    createdAt: record.createdAt.toISOString(),
  };
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
      currentValue: resolveAttribute(report.attribute, currentFacts, now).value ?? null,
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

export async function decideReport(
  store: ReportsStore,
  body: ModerationDecision,
  moderator: string,
  now: Date = new Date(),
): Promise<Report> {
  const result = await store.decide({
    reportId: body.reportId,
    decision: body.decision,
    note: body.note?.trim() || null,
    moderator,
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
