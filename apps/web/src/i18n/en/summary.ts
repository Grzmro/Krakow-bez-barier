import type { AccessibilityAttribute, FactValue } from "@krakow-bez-barier/contracts";
import type { Messages } from "../messages";
import { common } from "./common";

const UNIT = { cm: " cm", pct: "%", count: "", m: " m" } as const;

const OVERALL: Record<string, string> = {
  yes: "Wheelchair accessible (OSM)",
  limited: "Partly wheelchair accessible (OSM)",
  no: "Not wheelchair accessible (OSM)",
};

function valueLabel(attribute: AccessibilityAttribute, value: FactValue): string {
  const name = common.attribute[attribute];
  if (attribute === "step_count" && value.kind === "number") {
    const n = value.number;
    return n === 0 ? "Step-free entrance" : `${n} ${n === 1 ? "step" : "steps"} at the entrance`;
  }
  if (attribute === "wheelchair_overall" && value.kind === "text" && OVERALL[value.text]) return OVERALL[value.text];
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
