import type { AccessibilityFact, FactValue, Reliability } from "./types";

export const NOW = new Date("2026-10-03T12:00:00Z");

export const bool = (boolean: boolean): FactValue => ({ kind: "boolean", boolean });
export const num = (number: number, unit: "cm" | "count" = "cm"): FactValue => ({ kind: "number", number, unit });
export const text = (t: string): FactValue => ({ kind: "text", text: t });

export function fact(
  attribute: AccessibilityFact["attribute"],
  value: FactValue,
  overrides: Partial<AccessibilityFact> & { sourceId?: string } = {},
): AccessibilityFact {
  const { sourceId = "osm", ...rest } = overrides;
  return {
    id: `${attribute}-${sourceId}`,
    attribute,
    value,
    unit: null,
    source: { id: sourceId, name: sourceId, kind: "community", recordRef: null },
    fetchedAt: "2026-10-01T00:00:00Z",
    observedAt: "2026-09-01T00:00:00Z",
    confirmedAt: null,
    reliability: "community" satisfies Reliability,
    evidence: null,
    status: "active",
    stale: false,
    ...rest,
  };
}
