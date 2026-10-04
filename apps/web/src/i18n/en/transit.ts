import type { Messages } from "../messages";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const transit: Messages["transit"] = {
  title: "Nearest departures",
  lead: (radius: number) =>
    `Stops within ${radius} m of the place and departures within the hour. Whether the vehicle takes a wheelchair comes from the operator's live data.`,
  loading: "Loading departures…",
  loadError: "Departures could not be loaded. The rest of the card works as usual.",
  retry: "Try again",
  noStops: (radius: number) => `No public transport stops within ${radius} m.`,
  noDepartures: "No departures within the next hour.",
  distance: (meters: number) => `${meters} m away`,
  platform: (platform: string) => `platform ${platform}`,
  mode: { tram: "Tram", bus: "Bus" },
  towards: "towards",
  departs: "departs",
  delay: (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes === 0) return "on time";
    return minutes > 0
      ? `${minutes} ${plural(minutes, "minute", "minutes")} late`
      : `${-minutes} ${plural(-minutes, "minute", "minutes")} early`;
  },
  vehicle: {
    accessible: "Wheelchair-accessible vehicle",
    inaccessible: "Vehicle not wheelchair-accessible",
    unverified: "Unverified",
    no_data: "No vehicle data",
    declared: "Carrier's declaration",
    conflict: "Conflicting",
  },
  evidenceTitle: "What the sources say",
  evidenceKind: {
    operator_flag: "Operator's flag (ZTP, live data)",
    fleet_type: "Fleet type (city configuration)",
    carrier_declaration: "Carrier's declaration",
  },
  evidenceValue: (accessible: boolean) => (accessible ? "wheelchair-accessible" : "not wheelchair-accessible"),
  evidenceReliability: {
    confirmed: "confirmed",
    community: "community",
    extracted: "extracted automatically",
    user_report: "user report",
    inferred: "inferred",
    sample: "SAMPLE",
  },
  evidenceLine: (kind: string, value: string, reliability: string, detail: string | null) =>
    `${kind}: ${value}${detail ? ` (${detail})` : ""} · reliability: ${reliability}`,
  vehicleNumber: (label: string) => `vehicle no. ${label}`,
  unverifiedHint:
    "“Unverified”: the operator flags every tram as wheelchair-accessible, high-floor ones too, so we don't treat it as confirmation. “No data”: the live data says nothing about the vehicle — that doesn't mean it is accessible.",
  sourceLabel: "Source:",
  fetchedAt: (time: string) => `data from ${time}`,
  licenseLabel: "licence:",
  recorded: (time: string) => `A recording of the operator's data from ${time} — these are not live departures.`,
  outage: (time: string) => `The operator's data is unavailable right now. Showing the last data we fetched, from ${time}.`,
  stale: (time: string) => `The operator's data hasn't updated since ${time} — departures may be out of date.`,
  outageNoData: "The operator's data is unavailable right now and we have nothing earlier. Check the departure board at the stop.",
  disabled: "Departures with vehicle accessibility will appear once the ZTP data licence is confirmed.",
  statusNote: {
    stale: "The operator's data has stopped updating. Showing the last data; it may be out of date.",
    disabled: "Not served: the ZTP data licence is awaiting confirmation.",
    outage: "The operator's data is unavailable. Showing the last data fetched.",
    partialOutage: (modes: ("tram" | "bus")[]) =>
      `Part of the operator's data is unavailable (${modes.map((m) => (m === "tram" ? "trams" : "buses")).join(", ")}). For that part we show the last data fetched.`,
  },
};
