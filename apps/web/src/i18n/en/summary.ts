import type { AccessibilityAttribute, FactValue } from "@krakow-bez-barier/contracts";
import { factValueText, joinValue } from "../fact-value";
import type { Messages } from "../messages";
import { common } from "./common";
import { place } from "./place";

const SHORT_NAME: Partial<Record<AccessibilityAttribute, string>> = { step_count: "Entrance" };

const nameOf = (attribute: AccessibilityAttribute) => SHORT_NAME[attribute] ?? common.attribute[attribute];

function valueLabel(attribute: AccessibilityAttribute, value: FactValue): string {
  const text = joinValue(factValueText(attribute, value, place, "en"));
  if (attribute === "wheelchair_overall" && value.kind === "text" && place.overall[value.text]) return text;
  return `${nameOf(attribute)}: ${text.charAt(0).toLowerCase() + text.slice(1)}`;
}

export const summary: Messages["summary"] = {
  chip: (attribute, state, value) => {
    if (state === "conflict") return `${nameOf(attribute)}: conflicting data`;
    if (!value || state === "unknown") return `${nameOf(attribute)}: no data`;
    return state === "stale" ? `${valueLabel(attribute, value)} · outdated` : valueLabel(attribute, value);
  },
};
