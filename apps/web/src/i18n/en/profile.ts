import type { Need, OutageEquipment, Profile } from "@krakow-bez-barier/contracts";
import type { Status } from "@krakow-bez-barier/ui";
import type { Messages } from "../messages";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const places = (n: number) => `${n} ${plural(n, "place", "places")}`;

const needName = {
  entrance: "Entrance",
  door: "Door",
  lift: "Lift",
  toilet: "Accessible toilet",
  surface: "Surface",
  changing_table: "Changing table",
  bench: "Bench",
} satisfies Record<Need, string>;

const counts = (byStatus: Record<Status, number>) =>
  `${byStatus.met} meet, ${byStatus.barrier} don't meet, ${byStatus.unknown} no data, ${byStatus.conflict} conflicting`;

const profileName = { wheelchair: "Wheelchair", stroller: "Pushchair", senior: "Senior" } satisfies Record<Profile, string>;

export const profile: Messages["profile"] = {
  switch: {
    label: "Needs profile",
    off: "For everyone",
    offAria: "Profile off, view for everyone",
    short: { wheelchair: "Wheelchair", stroller: "Pushchair", senior: "Senior" },
  },
  name: profileName,
  settings: "Profile thresholds",
  needName,
  thresholds: {
    title: "Profile thresholds",
    proposal: "You can change the defaults.",
    maxThresholdCm: "Max. threshold",
    minDoorWidthCm: "Min. entrance width",
    requireStepFree: "Step-free",
    requireStepFreeHint: "When off, 1 step is acceptable",
    requireLift: "Lift where there are floors",
    requireAccessibleToilet: "Accessible toilet",
    requireSmoothSurface: "Even surface",
    requireChangingTable: "Changing table",
    requireBench: "Bench or a place to rest",
    cm: "cm",
    decrease: (label: string) => `Decrease: ${label}`,
    increase: (label: string) => `Increase: ${label}`,
    browserOnly: "Settings stay only in this browser.",
    reset: "Restore defaults",
    done: "Done",
  },
  hideFailing: "Hide places that don't meet",
  counter: (n: number, status: string) => `${n} ${status.toLowerCase()}`,
  countersLabel: "Show only places with the result",
  announce: (active: Profile, shown: number, total: number, byStatus: Record<Status, number>) =>
    `Profile: ${profileName[active].toLowerCase()}. ${shown === total ? places(total) : `Showing ${shown} of ${places(total)}`}: ${counts(byStatus)}.`,
  reasons: {
    steps: (n: number) => `${n} ${plural(n, "step", "steps")}`,
    threshold: (cm: number) => `${cm} cm threshold`,
    door: (cm: number) => `${cm} cm door`,
    surface: "uneven surface",
    overallNo: "Marked as not wheelchair accessible",
    overallOnly: (value: "yes" | "limited") =>
      value === "yes" ? "entrance: marked accessible overall, no details" : "entrance: marked partly accessible overall, no details",
    missing: (need: Need) => `${needName[need].toLowerCase()}: none`,
    liftWithoutFloors: "lift: none, floors: no data",
    liftFloorsConflict: "lift: none, floors: conflicting data",
    unresolved: (need: Need) => needName[need].toLowerCase(),
    conflictElsewhere: "conflicting data about the place",
    outage: (equipment: OutageEquipment) => (equipment === "lift" ? "lift reported out of order" : "ramp reported out of order"),
  },
  groups: {
    barrier: "Blocks",
    met: "Fits",
    unknown: "Unknown",
  },
  list: {
    details: "Why?",
    detailsAria: (place: string, state: "met" | "barrier" | "unknown" | "conflict") =>
      `Why ${{ met: `does ${place} meet`, barrier: `does ${place} not meet`, unknown: `does ${place} have no data`, conflict: `does ${place} have conflicting data` }[state]}?`,
    hideDetails: "Hide",
    hideDetailsAria: (place: string) => `Hide the explanation: ${place}`,
    showAll: "Show all results",
    filteredEmpty: "No place matches the selected result",
    filteredEmptyHint: "The profile result filter hides the results.",
    noneMet: {
      title: "No place on the list has complete data for this profile yet",
      missing: (missing: { need: Need; count: number }[], total: number) =>
        `Most often missing: ${missing.map(({ need, count }) => `${needName[need].toLowerCase()} (${count} of ${total})`).join(", ")}.`,
      hint: "Open data rarely records steps, thresholds or door width. “No data” doesn't mean “not accessible” — see “Why?” on a place.",
    },
  },
};
