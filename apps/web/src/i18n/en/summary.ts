import type { AccessibilityAttribute, FactValue } from "@krakow-bez-barier/contracts";
import { intlLocale } from "../locale";
import type { Messages } from "../messages";
import { common } from "./common";
import { place } from "./place";

const SHORT_NAME: Partial<Record<AccessibilityAttribute, string>> = { step_count: "Entrance" };

const nameOf = (attribute: AccessibilityAttribute) => SHORT_NAME[attribute] ?? common.attribute[attribute];

function valueText(attribute: AccessibilityAttribute, value: FactValue): string {
  switch (value.kind) {
    case "boolean":
      return (value.boolean ? place.value.yes : place.value.no).toLowerCase();
    case "number": {
      if (attribute === "step_count") return value.number === 0 ? place.value.noSteps.toLowerCase() : place.value.steps(value.number);
      const n = value.number.toLocaleString(intlLocale.en, { maximumFractionDigits: 2, useGrouping: false });
      const unit = value.unit ? place.unit[value.unit] : "";
      return unit ? `${n} ${unit}` : n;
    }
    case "text":
      return place.surface[value.text] ?? value.text;
  }
}

function valueLabel(attribute: AccessibilityAttribute, value: FactValue): string {
  if (attribute === "wheelchair_overall" && value.kind === "text" && place.overall[value.text]) return place.overall[value.text];
  return `${nameOf(attribute)}: ${valueText(attribute, value)}`;
}

export const summary: Messages["summary"] = {
  chip: (attribute, state, value) => {
    if (state === "conflict") return `${nameOf(attribute)}: conflicting data`;
    if (!value || state === "unknown") return `${nameOf(attribute)}: no data`;
    return state === "stale" ? `${valueLabel(attribute, value)} · outdated` : valueLabel(attribute, value);
  },
};
