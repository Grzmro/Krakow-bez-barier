import type { AccessibilityAttribute, FactValue } from "@krakow-bez-barier/contracts";
import { common } from "./common";

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

const UNIT = { cm: " cm", pct: "%", count: "", m: " m" } as const;

const OVERALL: Record<string, string> = {
  yes: "Dostępne dla wózków (OSM)",
  limited: "Częściowo dostępne dla wózków (OSM)",
  no: "Niedostępne dla wózków (OSM)",
};

function valueLabel(attribute: AccessibilityAttribute, value: FactValue): string {
  const name = common.attribute[attribute];
  if (attribute === "step_count" && value.kind === "number") {
    const n = value.number;
    return n === 0 ? "Wejście bez stopni" : `${n} ${plural(n, "stopień", "stopnie", "stopni")} przy wejściu`;
  }
  if (attribute === "wheelchair_overall" && value.kind === "text" && OVERALL[value.text]) return OVERALL[value.text];
  switch (value.kind) {
    case "boolean":
      return value.boolean ? name : `${name}: brak`;
    case "number":
      return `${name}: ${value.number}${value.unit ? UNIT[value.unit] : ""}`;
    case "text":
      return `${name}: ${value.text}`;
  }
}

// Short chip texts in place lists returned by the places API (`SummaryChip.label`).
export const summary = {
  chip: (attribute: AccessibilityAttribute, state: "known" | "stale" | "unknown" | "conflict", value: FactValue | null | undefined) => {
    if (state === "conflict") return `${common.attribute[attribute]}: sprzeczne dane`;
    if (!value || state === "unknown") return `${common.attribute[attribute]}: brak danych`;
    return state === "stale" ? `${valueLabel(attribute, value)} · nieaktualne` : valueLabel(attribute, value);
  },
} as const;
