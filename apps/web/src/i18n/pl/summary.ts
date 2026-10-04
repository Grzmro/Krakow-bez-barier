import type { AccessibilityAttribute, FactValue } from "@krakow-bez-barier/contracts";
import { intlLocale } from "../locale";
import { common } from "./common";
import { place } from "./place";

// The list names an attribute shorter where the value already says the rest ("Wejście: 2 stopnie").
const SHORT_NAME: Partial<Record<AccessibilityAttribute, string>> = { step_count: "Wejście" };

const nameOf = (attribute: AccessibilityAttribute) => SHORT_NAME[attribute] ?? common.attribute[attribute];

/** The value in the place card's words, lower-cased to follow "cecha:". */
function valueText(attribute: AccessibilityAttribute, value: FactValue): string {
  switch (value.kind) {
    case "boolean":
      return (value.boolean ? place.value.yes : place.value.no).toLowerCase();
    case "number": {
      if (attribute === "step_count") return value.number === 0 ? place.value.noSteps.toLowerCase() : place.value.steps(value.number);
      const n = value.number.toLocaleString(intlLocale.pl,{ maximumFractionDigits: 2, useGrouping: false });
      const unit = value.unit ? place.unit[value.unit] : "";
      return unit ? `${n} ${unit}` : n;
    }
    case "text":
      return place.surface[value.text] ?? value.text;
  }
}

function valueLabel(attribute: AccessibilityAttribute, value: FactValue): string {
  // The overall tag is already a whole sentence ("Częściowo dostępne dla wózków"), as on the card.
  if (attribute === "wheelchair_overall" && value.kind === "text" && place.overall[value.text]) return place.overall[value.text];
  return `${nameOf(attribute)}: ${valueText(attribute, value)}`;
}

// Short chip texts in place lists returned by the places API (`SummaryChip.label`): always "cecha: wartość".
export const summary = {
  chip: (attribute: AccessibilityAttribute, state: "known" | "stale" | "unknown" | "conflict", value: FactValue | null | undefined) => {
    if (state === "conflict") return `${nameOf(attribute)}: sprzeczne dane`;
    if (!value || state === "unknown") return `${nameOf(attribute)}: brak danych`;
    return state === "stale" ? `${valueLabel(attribute, value)} · nieaktualne` : valueLabel(attribute, value);
  },
} as const;
