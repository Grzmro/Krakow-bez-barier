import type { AccessibilityAttribute, FactValue } from "@krakow-bez-barier/contracts";
import type { Messages } from "../messages";
import { common } from "./common";
import { place } from "./place";

const UNIT = { cm: " cm", pct: "%", count: "", m: " m" } as const;

function valueLabel(attribute: AccessibilityAttribute, value: FactValue): string {
  const name = common.attribute[attribute];
  if (attribute === "step_count" && value.kind === "number") {
    const n = value.number;
    return n === 0 ? "Step-free entrance" : `${n} ${n === 1 ? "step" : "steps"} at the entrance`;
  }
  if (attribute === "wheelchair_overall" && value.kind === "text" && place.overall[value.text]) return place.overall[value.text];
  switch (value.kind) {
    case "boolean":
      return value.boolean ? name : `${name}: none`;
    case "number":
      return `${name}: ${value.number}${value.unit ? UNIT[value.unit] : ""}`;
    case "text":
      return `${name}: ${value.text}`;
  }
}

export const summary: Messages["summary"] = {
  chip: (attribute, state, value) => {
    if (state === "conflict") return `${common.attribute[attribute]}: conflicting data`;
    if (!value || state === "unknown") return `${common.attribute[attribute]}: no data`;
    return state === "stale" ? `${valueLabel(attribute, value)} · outdated` : valueLabel(attribute, value);
  },
};
