import { reportRules, type AccessibilityAttribute, type FactValue, type ValueRange } from "@krakow-bez-barier/contracts";
import { pl } from "@/i18n/pl";
import type { FactView } from "./place-facts";

const t = pl.place;
const o = t.report.option;

export type ReportOption = { id: string; label: string; value: FactValue };

/** What the "Jak jest naprawdę?" field looks like for an attribute. */
export type ReportInput = { kind: "number"; range: ValueRange } | { kind: "choice"; options: ReportOption[] };

const yesNo = (yes: string, no: string): ReportOption[] => [
  { id: "yes", label: yes, value: { kind: "boolean", boolean: true } },
  { id: "no", label: no, value: { kind: "boolean", boolean: false } },
];

const SURFACES = ["flat", "asphalt", "paving_stones", "concrete", "cobblestone", "sett", "gravel", "grass"];

const CHOICES: Partial<Record<AccessibilityAttribute, ReportOption[]>> = {
  ramp: yesNo(o.rampYes, o.rampNo),
  lift: yesNo(o.liftYes, o.liftNo),
  toilet_accessible: yesNo(o.toiletYes, o.toiletNo),
  changing_table: yesNo(o.yes, o.no),
  bench: yesNo(o.benchYes, o.no),
  disabled_parking: yesNo(o.parkingYes, o.no),
  entrance_level: yesNo(o.yes, o.no),
  wheelchair_overall: yesNo(o.yes, o.no),
  surface: SURFACES.map((s) => ({ id: s, label: t.surface[s], value: { kind: "text", text: s } })),
  smoothness: SURFACES.map((s) => ({ id: s, label: t.surface[s], value: { kind: "text", text: s } })),
};

/** Numeric attributes take a number within the contract's range; the rest a choice of values. */
export function reportInput(attribute: AccessibilityAttribute): ReportInput {
  const range = reportRules.valueRanges[attribute];
  if (range) return { kind: "number", range };
  return { kind: "choice", options: CHOICES[attribute] ?? yesNo(o.yes, o.no) };
}

export function unitLabel(range: ValueRange): string {
  return t.unit[range.unit];
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
