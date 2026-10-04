import type { AccessibilityAttribute, FactValue } from "@krakow-bez-barier/contracts";
import { factValueText, joinValue } from "../fact-value";
import { common } from "./common";
import { place } from "./place";

// The list names an attribute shorter where the value already says the rest ("Wejście: 2 stopnie").
const SHORT_NAME: Partial<Record<AccessibilityAttribute, string>> = { step_count: "Wejście" };

const nameOf = (attribute: AccessibilityAttribute) => SHORT_NAME[attribute] ?? common.attribute[attribute];

function valueLabel(attribute: AccessibilityAttribute, value: FactValue): string {
  const text = joinValue(factValueText(attribute, value, place, "pl"));
  // The overall tag is already a whole sentence ("Częściowo dostępne dla wózków"), as on the card.
  if (attribute === "wheelchair_overall" && value.kind === "text" && place.overall[value.text]) return text;
  return `${nameOf(attribute)}: ${text.charAt(0).toLocaleLowerCase("pl") + text.slice(1)}`;
}

// Short chip texts in place lists returned by the places API (`SummaryChip.label`): always "cecha: wartość",
// in the place card's words.
export const summary = {
  chip: (attribute: AccessibilityAttribute, state: "known" | "stale" | "unknown" | "conflict", value: FactValue | null | undefined) => {
    if (state === "conflict") return `${nameOf(attribute)}: sprzeczne dane`;
    if (!value || state === "unknown") return `${nameOf(attribute)}: brak danych`;
    return state === "stale" ? `${valueLabel(attribute, value)} · nieaktualne` : valueLabel(attribute, value);
  },
} as const;
