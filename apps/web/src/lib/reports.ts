import {
  reportRules,
  type AccessibilityAttribute,
  type Contribution,
  type FactValue,
  type Place,
  type ValueRange,
} from "@krakow-bez-barier/contracts";
import type { Locale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";
import { formatValue, joinValue, type FactView } from "./place-facts";

export type ReportOption = { id: string; label: string; value: FactValue };

/** What the "Jak jest naprawdę?" field looks like for an attribute. */
export type ReportInput = { kind: "number"; range: ValueRange } | { kind: "choice"; options: ReportOption[] };

const yesNo = (yes: string, no: string): ReportOption[] => [
  { id: "yes", label: yes, value: { kind: "boolean", boolean: true } },
  { id: "no", label: no, value: { kind: "boolean", boolean: false } },
];

// OSM `wheelchair=*` values, the same text facts the matcher reads.
const OVERALL = ["yes", "limited", "no"];

const SURFACES = ["flat", "asphalt", "paving_stones", "concrete", "cobblestone", "sett", "gravel", "grass"];

function choices(locale: Locale): Partial<Record<AccessibilityAttribute, ReportOption[]>> {
  const t = messagesFor(locale).place;
  const o = t.report.option;
  return {
  ramp: yesNo(o.rampYes, o.rampNo),
  lift: yesNo(o.liftYes, o.liftNo),
  toilet_accessible: yesNo(o.toiletYes, o.toiletNo),
  changing_table: yesNo(o.yes, o.no),
  bench: yesNo(o.benchYes, o.no),
  disabled_parking: yesNo(o.parkingYes, o.no),
  entrance_level: yesNo(o.yes, o.no),
  wheelchair_overall: OVERALL.map((v) => ({ id: v, label: t.overall[v], value: { kind: "text", text: v } })),
  surface: SURFACES.map((s) => ({ id: s, label: t.surface[s], value: { kind: "text", text: s } })),
  };
}

/** Numeric attributes take a number within the contract's range; the rest a choice of values. */
export function reportInput(attribute: AccessibilityAttribute, locale: Locale): ReportInput {
  const range = reportRules.valueRanges[attribute];
  if (range) return { kind: "number", range };
  const o = messagesFor(locale).place.report.option;
  return { kind: "choice", options: choices(locale)[attribute] ?? yesNo(o.yes, o.no) };
}

export function unitLabel(range: ValueRange, locale: Locale): string {
  return messagesFor(locale).place.unit[range.unit];
}

/** A report or confirmation awaiting moderation, kept beside the fact until a moderator decides. */
export interface PendingEntry {
  key: string;
  kind: "report" | "confirmation";
  /** Sent from this device; otherwise someone's report served by the places API. */
  mine: boolean;
  /** The report's id once the server has it. */
  reportId?: string;
  attribute: AccessibilityAttribute;
  /** Reported value as text; for a confirmation, the value confirmed. */
  valueText?: string;
  /** ISO date: local time while sending, then the server's `createdAt`. */
  createdAt: string;
  sending: boolean;
}

/**
 * This device's entries, at most one per attribute: a report still held locally (undo window, sending) wins over what
 * the API lists for the device (`GET /places/{id}/contributions`), which the API already keeps to one per attribute.
 */
export function ownEntries(contributions: Contribution[], local: PendingEntry[], locale: Locale): PendingEntry[] {
  const byAttribute = new Map<AccessibilityAttribute, PendingEntry>();
  for (const c of contributions) {
    byAttribute.set(c.attribute, {
      key: c.id,
      kind: c.kind,
      mine: true,
      ...(c.kind === "report" && { reportId: c.id }),
      attribute: c.attribute,
      valueText: joinValue(formatValue(c.attribute, c.value, locale)),
      createdAt: c.createdAt,
      sending: false,
    });
  }
  for (const entry of local) {
    // Sending a report replaces the device's pending one of that attribute, which keeps its id on the server.
    const replaces = byAttribute.get(entry.attribute)?.reportId;
    byAttribute.set(entry.attribute, replaces && !entry.reportId ? { ...entry, reportId: replaces } : entry);
  }
  return [...byAttribute.values()];
}

/**
 * Every report the API lists as pending (`ResolvedAttribute.pendingReports`) from other devices, followed by this
 * device's own entries (one per attribute). A served report this device sent shows once, as its own entry; one of an
 * attribute it is changing right now is hidden, since the change replaces it. Comments are left out: free text nobody
 * has moderated yet is not shown to other visitors.
 */
export function pendingEntries(place: Place, own: PendingEntry[], locale: Locale): PendingEntry[] {
  const ownIds = new Set(own.flatMap((e) => (e.reportId ? [e.reportId] : [])));
  const served = place.attributes.flatMap(({ attribute, pendingReports = [] }) =>
    pendingReports
      .filter((report) => !ownIds.has(report.id))
      .map(
        (report): PendingEntry => ({
          key: report.id,
          kind: "report",
          mine: false,
          reportId: report.id,
          attribute,
          valueText: joinValue(formatValue(attribute, report.value, locale)),
          createdAt: report.createdAt,
          sending: false,
        }),
      ),
  );
  return [...served, ...own];
}

export type FactWithPending = FactView & { pending: PendingEntry[] };

/**
 * Attaches the pending entries — reports the API serves for every visitor and this visitor's own ones — to the card rows. The row's value, reliability and sources stay exactly as the
 * API resolved them — an unmoderated report never changes what the card (or any verdict) says.
 */
export function withPending(views: FactView[], pending: PendingEntry[]): FactWithPending[] {
  return views.map((view) => ({ ...view, pending: pending.filter((p) => p.attribute === view.attribute) }));
}
