import { reportRules, type AccessibilityAttribute, type FactValue, type ValueRange } from "@krakow-bez-barier/contracts";
import type { Locale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";
import type { FactView } from "./place-facts";

export type ReportOption = { id: string; label: string; value: FactValue };

/** What the "Jak jest naprawdę?" field looks like for an attribute. */
export type ReportInput = { kind: "number"; range: ValueRange } | { kind: "choice"; options: ReportOption[] };

const yesNo = (yes: string, no: string): ReportOption[] => [
  { id: "yes", label: yes, value: { kind: "boolean", boolean: true } },
  { id: "no", label: no, value: { kind: "boolean", boolean: false } },
];

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
  wheelchair_overall: yesNo(o.yes, o.no),
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

/** A visitor's own report or confirmation, kept beside the fact until a moderator decides. */
export interface PendingEntry {
  key: string;
  kind: "report" | "confirmation";
  attribute: AccessibilityAttribute;
  /** Reported value as text; for a confirmation, the value confirmed. */
  valueText?: string;
  /** ISO date: local time while sending, then the server's `createdAt`. */
  createdAt: string;
  sending: boolean;
}

export type FactWithPending = FactView & { pending: PendingEntry[] };

/**
 * Attaches the visitor's pending entries to the card rows. The row's value, reliability and sources stay exactly as the
 * API resolved them — an unmoderated report never changes what the card (or any verdict) says.
 */
export function withPending(views: FactView[], pending: PendingEntry[]): FactWithPending[] {
  return views.map((view) => ({ ...view, pending: pending.filter((p) => p.attribute === view.attribute) }));
}
