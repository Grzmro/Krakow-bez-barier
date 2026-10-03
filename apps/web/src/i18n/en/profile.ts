import type { Need, Profile } from "@krakow-bez-barier/contracts";
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
    proposal: "The defaults are a suggestion. Adjust them to suit you.",
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
    overallNo: "OSM: not wheelchair accessible",
    missing: (need: Need) => `${needName[need].toLowerCase()}: none`,
    liftWithoutFloors: "lift: none, floors: no data",
    liftFloorsConflict: "lift: none, floors: conflicting data",
    unresolved: (need: Need) => needName[need].toLowerCase(),
    conflictElsewhere: "conflicting data about the place",
  },
  groups: {
    barrier: "Blocks",
    met: "Fits",
    unknown: "Unknown",
  },
  list: {
    details: "Why?",
    detailsAria: (place: string) => `Why? ${place}`,
    hideDetails: "Hide details",
    hideDetailsAria: (place: string) => `Hide details: ${place}`,
    showAll: "Show all results",
    filteredEmpty: "No place matches the selected result",
    filteredEmptyHint: "There are search results, but the profile result filter hides them.",
  },
};
