import type { Profile } from "@krakow-bez-barier/contracts";
import type { Messages } from "../messages";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const profileName = { wheelchair: "wheelchair", stroller: "pushchair" } satisfies Record<Profile, string>;

const km = (meters: number) => `${(meters / 1000).toFixed(1)} km`;

export const route: Messages["route"] = {
  pageTitle: "Route",
  places: {
    dworzec: "Main Railway Station",
    rynek: "Main Market Square",
  },
  from: "From",
  to: "To",
  swap: "Swap start and destination",
  kind: "Route type",
  avoidStairs: "Avoid stairs",
  shortest: "Shortest",
  minutes: (n: number) => `${n} min`,
  distance: km,
  headingAria: (minutes: number, meters: number) => `Route: ${minutes} minutes, ${km(meters)}`,
  profileOn: (p: Profile) =>
    `Checked against your profile limits: ${profileName[p]} (incline, surface; kerbs where we have data on them).`,
  profileOff: "Without a profile we check stairs and surface. Turn on a profile to check kerbs and incline.",
  loading: "Finding a route…",
  noKnown: "No known barriers on this route",
  unknownOn: (n: number, m: number) =>
    `no data on ${n} ${plural(n, "segment", "segments")}${n ? ` (${Math.round(m)} m)` : ""}`,
  conflictOn: (n: number) => `conflicting data on ${n} ${plural(n, "segment", "segments")}`,
  hasBarriers: (list: string) => `On the route: ${list}`,
  noneOk: "No route meets your needs",
  noneOkNoProfile: "No step-free route",
  alternative: "Best alternative — barriers:",
  alternativeUnmet: "Best alternative — no known barriers, but it doesn't meet:",
  limitsProfile: (kerbCm: number, smooth: boolean) =>
    `kerb up to ${kerbCm} cm, acceptable incline${smooth ? ", smooth surface" : ""}`,
  limitsNoProfile: "step-free",
  segments: "Route segments",
  segmentsHint: "The bar shows segments to scale. Details are in the “Step by step” list.",
  steps: "Step by step",
  stepsAria: "Route segments, text version of the map",
  segmentAria: (i: number, n: number, instruction: string, m: number, status: string, note: string) =>
    `Segment ${i} of ${n}. ${instruction}, ${Math.round(m)} ${plural(Math.round(m), "metre", "metres")}. ${status}${note ? `: ${note}` : ""}.`,
  meters: (m: number) => `${Math.round(m)} m`,
  nobody: "Nobody has checked this segment yet.",
  sourceLine: (name: string, date: string) => `${name} · ${date}`,
  destination: {
    title: "Destination: entrance",
    hint: "Facts from the place card.",
    open: "Open the place card",
  },
  attribution: "Route",
  go: "Let's go",
  goSoon: "Turn-by-turn navigation in a later version",
  error: {
    unavailable: "Route planning is temporarily unavailable. The rest of the app works — check places in the list.",
    noRoute: "We couldn't find a route between these points.",
    noPlace: "We couldn't find the destination. The link may be out of date.",
    retry: "Try again",
  },
  back: "Back",
  map: {
    label: "Route map. The same route is described in the “Step by step” list.",
    unavailable: "The map isn't available in this browser. The whole route is in the “Step by step” list.",
  },
  note: {
    stairs: "stairs",
    kerb: (cm: number) => `${cm} cm kerb`,
    incline: (pct: number) => `incline up to ${pct}%`,
    inclineLow: "flat (up to 1%)",
    rough: (surface: string) => `surface: ${surface}`,
    conflict: (attributes: string) => `conflicting data: ${attributes}`,
    noSurface: "no surface data",
    partSurface: "no surface data on part of the segment",
    noStairs: "no data on stairs",
    noIncline: "no incline data",
    noKerb: "no kerb data",
    separator: ", ",
  },
};
