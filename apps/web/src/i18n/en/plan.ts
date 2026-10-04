import type { Messages } from "../messages";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const plan: Messages["plan"] = {
  pageTitle: "Day plan",
  lead: "Add 2 to 5 places from their cards and set the order. We route each leg separately, with your profile. The plan stays in this browser.",
  add: "Add to plan",
  addedShort: "In plan",
  added: (name) => `Added to the day plan: ${name}`,
  full: (max) => `The plan already has ${max} places. Remove one to add another.`,
  openPlan: "See the day plan",
  empty: "The plan is empty. Open a place card and choose “Add to plan”.",
  needSecond: "Add one more place to see the route.",
  findPlaces: "Find places",
  stopsHeading: "Places in the plan",
  legsHeading: "Route legs",
  stopLabel: (n, name) => `${n}. ${name}`,
  moveUp: (name) => `Move up: ${name}`,
  moveDown: (name) => `Move down: ${name}`,
  remove: (name) => `Remove from plan: ${name}`,
  moved: (name, position, total) => `${name}: position ${position} of ${total}`,
  removed: (name) => `Removed from the plan: ${name}`,
  clear: "Clear plan",
  cleared: "Plan cleared",
  loadingPlace: "Loading the place card…",
  placeMissing: "We couldn't find this place. You can remove it from the plan.",
  verdict: {
    noProfile: "Choose a profile to assess this place.",
    profile: "Assessment for your profile",
  },
  leg: (from, to) => `${from} → ${to}`,
  legLoading: "Planning this leg…",
  legNoRoute: "We couldn't find a route for this leg.",
  legUnavailable: "Route planning is temporarily unavailable.",
  notConfigured: "This server has no openrouteservice key, so we can't plan the route legs. The list of places works, but we won't show travel time or barriers on the way.",
  legBarriers: (list) => `Barriers on this leg: ${list}`,
  legNoKnown: "No known barriers on this leg",
  legFallback: "No leg meets your needs; this is the best available alternative.",
  summary: {
    heading: "Summary",
    total: (minutes, distance) => `Total: ${minutes} min, ${distance}`,
    partial: (minutes, distance) => `Legs planned so far: ${minutes} min, ${distance}. We don't know the rest, so this is not the time of the whole plan.`,
    none: "No leg planned yet.",
    counts: (barrier, conflict, unknown, met) =>
      [
        barrier ? `${barrier} ${plural(barrier, "leg with a barrier", "legs with barriers")}` : null,
        conflict ? `${conflict} ${plural(conflict, "leg with conflicting data", "legs with conflicting data")}` : null,
        unknown ? `${unknown} ${plural(unknown, "leg with no data", "legs with no data")}` : null,
        met ? `${met} ${plural(met, "leg with no known barriers", "legs with no known barriers")}` : null,
      ]
        .filter(Boolean)
        .join(", "),
    loading: (n) => `${n} more ${plural(n, "leg", "legs")} to plan.`,
    failed: (n) => `${n} ${plural(n, "leg", "legs")} without a route.`,
  },
  unknownNote: "No data does not mean the leg is accessible.",
  route: "Route to this place",
};
