import { reportRules } from "./generated/report-rules";
import type { components } from "./generated/schema";

type AccessibilityAttribute = components["schemas"]["AccessibilityAttribute"];
type NumberUnit = Extract<components["schemas"]["FactValue"], { kind: "number" }>["unit"];

export type ValueRange = { min: number; max: number; unit: NonNullable<NumberUnit> };

export type ReportRules = {
  /** `ReportCreate.comment.maxLength`. */
  commentMaxLength: number | null;
  /** Inclusive bounds for numeric report values, per attribute (`ReportCreate.x-value-ranges`). */
  valueRanges: Partial<Record<AccessibilityAttribute, ValueRange>>;
};

export { reportRules };

export type RangeCheck = { ok: true; value: number } | { ok: false; reason: "empty" | "not_a_number" | "out_of_range" };

/** Checks a typed-in number against the contract's range for the attribute. */
export function checkReportNumber(attribute: AccessibilityAttribute, raw: string, rules: ReportRules = reportRules): RangeCheck {
  const range = rules.valueRanges[attribute];
  const text = raw.trim().replace(",", ".");
  if (text === "") return { ok: false, reason: "empty" };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, reason: "not_a_number" };
  if (range && (value < range.min || value > range.max)) return { ok: false, reason: "out_of_range" };
  return { ok: true, value };
}
