import type { AccessibilityAttribute } from "./types";

export type Rule =
  | { type: "max"; value: number }
  | { type: "min"; value: number }
  | { type: "isTrue" }
  | { type: "enum"; met: string[]; barrier: string[] };

export type Condition = {
  attribute: AccessibilityAttribute;
  rule: Rule;
  /** A failing blocking condition makes the whole need a barrier even if alternatives are unknown. */
  blocking?: boolean;
};

export type Need = {
  id: string;
  label: string;
  /** `any`: one passing condition is enough (alternatives). `all`: every condition must pass. */
  mode: "any" | "all";
  conditions: Condition[];
};

export type ProfileConfig = {
  id: string;
  needs: Need[];
};

const stepFreeEntrance: Need = {
  id: "entrance",
  label: "Wejście bez schodów",
  mode: "any",
  conditions: [
    { attribute: "step_count", rule: { type: "max", value: 0 } },
    { attribute: "ramp", rule: { type: "isTrue" } },
    { attribute: "lift", rule: { type: "isTrue" } },
    {
      attribute: "wheelchair_overall",
      rule: { type: "enum", met: ["yes"], barrier: ["no"] },
      blocking: true,
    },
  ],
};

const accessibleToilet: Need = {
  id: "toilet",
  label: "Toaleta dostosowana",
  mode: "all",
  conditions: [{ attribute: "toilet_accessible", rule: { type: "isTrue" } }],
};

export const profiles: Record<string, ProfileConfig> = {
  wheelchair: {
    id: "wheelchair",
    needs: [
      stepFreeEntrance,
      {
        id: "threshold",
        label: "Próg do 2 cm",
        mode: "all",
        conditions: [{ attribute: "threshold_cm", rule: { type: "max", value: 2 } }],
      },
      {
        id: "door",
        label: "Szerokość wejścia co najmniej 90 cm",
        mode: "all",
        conditions: [{ attribute: "door_width_cm", rule: { type: "min", value: 90 } }],
      },
      accessibleToilet,
    ],
  },
  stroller: {
    id: "stroller",
    needs: [
      stepFreeEntrance,
      {
        id: "threshold",
        label: "Próg do 5 cm",
        mode: "all",
        conditions: [{ attribute: "threshold_cm", rule: { type: "max", value: 5 } }],
      },
      {
        id: "door",
        label: "Szerokość wejścia co najmniej 70 cm",
        mode: "all",
        conditions: [{ attribute: "door_width_cm", rule: { type: "min", value: 70 } }],
      },
      accessibleToilet,
      {
        id: "changing_table",
        label: "Przewijak",
        mode: "all",
        conditions: [{ attribute: "changing_table", rule: { type: "isTrue" } }],
      },
    ],
  },
};
