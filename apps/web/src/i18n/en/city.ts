import type { components } from "@krakow-bez-barier/contracts";
import type { Messages } from "../messages";

type PriorityFactor = components["schemas"]["PriorityFactor"];

const places = (n: number) => `${n} ${n === 1 ? "place" : "places"}`;

const criterion: Record<PriorityFactor, (p: number, max: number | null, categories: string) => string> = {
  barrier: (p) => `+${p} pts for each need with a known barrier (e.g. steps at the entrance, no lift, no accessible toilet)`,
  open_report: (p, max) => `+${p} pts for each report awaiting a decision${max ? ` (at most ${max} count)` : ""}`,
  conflict: (p) => `+${p} pts for each attribute on which sources disagree`,
  busy_category: (p, _max, categories) =>
    `+${p} pts for a place many people visit (${categories}) — only together with another reason`,
  missing_entrance_data: (p) => `+${p} pts when nothing is known about the entrance`,
  stale_data: (p) => `+${p} pts when all we have on some attribute is outdated (older than 12 months or the source isn't refreshing)`,
};

const reason: Record<PriorityFactor, (count: number, needs: string) => string> = {
  barrier: (_count, needs) => `barrier: ${needs}`,
  open_report: (count) => `${count} ${count === 1 ? "report" : "reports"} awaiting a decision`,
  conflict: (count) => (count > 1 ? `conflicting sources on ${count} attributes` : "conflicting sources"),
  busy_category: () => "busy place",
  missing_entrance_data: () => "no entrance data",
  stale_data: () => "outdated data",
};

export const city: Messages["city"] = {
  title: "City dashboard",
  signInLead: "The city dashboard uses the same sign-in as the moderator panel — the demo account included.",
  signedIn: "Signed in. The city statistics are below.",
  loading: "Computing the statistics…",
  loaded: (total: number) => `Statistics ready: ${places(total)} in the database.`,
  loadFailed: "Couldn't load the statistics.",
  loadLockedOut: (minutes: number) => `Too many failed attempts. The statistics will be available in ${minutes} min.`,
  intro: "Figures from the Kraków bez barier database: OpenStreetMap, the city's open data and residents' reports.",
  introRules: "Aggregates only, no personal data. Missing data never counts as “accessible”.",
  scope: (excluded: string) =>
    `Every place is counted except the categories hidden on the map by default (${excluded}) — the “Wheelchair” needs don't apply to them.`,
  introSample: "Sample mode: statistics computed from the sample places, not from Kraków's data.",
  realOnly: "Places and facts marked SAMPLE are left out.",
  generatedAt: (date: string) => `As of ${date}`,
  tiles: {
    heading: "At a glance",
    places: "Places in the database",
    withData: "With accessibility data",
    withoutData: "Without any data",
    openReports: "Reports to decide",
    stale: "Places with outdated data (>12 months or the source isn't refreshing)",
    staleFacts: (n: number) => `${n} ${n === 1 ? "fact" : "facts"}`,
    conflicts: "Places with conflicting sources",
    conflictAttributes: (n: number) => `${n} ${n === 1 ? "attribute" : "attributes"}`,
    share: (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}% of places` : "—"),
  },
  gus: {
    heading: "Kraków in Statistics Poland figures",
    lead: "Who the barriers affect: public Statistics Poland (GUS) data for the whole city, not broken down by district.",
    label: {
      disabled: "People with disabilities",
      postWorkingAge: "People of post-working age",
      population: "Residents",
      museumsAdapted: "Museums adapted for people with disabilities",
      museumVisitors: "Museum visitors per year",
    },
    outOf: (part: string, total: string) => `${part} of ${total}`,
    year: (year: number, variableId: number) => `${year} · BDL variable ${variableId}`,
    census: (year: number, variableId: number) => `National Census ${year} · BDL variable ${variableId}`,
    museumsYear: (year: number, adaptedId: number, totalId: number) => `${year} · BDL variables ${adaptedId} and ${totalId}`,
    museumsNote: "GUS doesn't say what “adapted” means in a given museum — the place card shows that.",
    sourcePrefix: "Source:",
    licenseFetched: (license: string, date: string) => `, licence ${license}. Fetched ${date}.`,
  },
  needs: {
    heading: "Barriers and data gaps by need",
    lead: "Every place checked as the “Wheelchair” profile does (entrance, door at least 90 cm, lift, accessible toilet) and for a smooth surface.",
    caption: "Number of places by result for each need",
    need: "Need",
    chartLabel: (need: string, barrier: number, total: number) => `${need}: ${barrier} of ${total} with a barrier`,
    state: {
      met: "Meets",
      barrier: "Barrier",
      conflict: "Conflicting",
      unknown: "No data",
    },
  },
  reports: {
    heading: "Residents' reports",
    caption: "Number of reports by status",
    status: "Status",
    count: "Count",
  },
  priorities: {
    heading: "Repair and data priorities",
    lead: "Places worth dealing with first. The score is the sum of points for each reason:",
    criterion,
    noVisits:
      "We have no visitor counts, so the place's category stands in for footfall. The weights are public and easy to change.",
    caption: (shown: number, total: number) => `Top ${shown} of ${places(total)} with at least one reason`,
    rank: "No.",
    place: "Place",
    category: "Category",
    score: "Points",
    action: "Action",
    reasons: "Reasons",
    actionName: {
      fix: "Repair",
      verify: "Fill in data",
    },
    reason,
    reasonWithPoints: (reasonText: string, p: number) => `${reasonText} (+${p})`,
    empty: "No place has barriers, data gaps or reports.",
    regionLabel: "Priority table (scrolls horizontally)",
    exportCsv: "Download CSV",
    exported: (shown: number, total: number) =>
      shown < total ? `Downloaded a CSV: the top ${shown} of ${places(total)} in the ranking.` : `Downloaded a CSV: the whole ranking, ${places(total)}.`,
    exportFailed: "Couldn't download the ranking as CSV.",
    csvFile: (date: string, shown: number) => `accessibility-priorities-krakow-top-${shown}-${date}.csv`,
    csvHeader: ["No.", "Place", "Category", "Points", "Action", "Reasons", "Reports to decide", "Longitude", "Latitude", "Id"],
  },
};
