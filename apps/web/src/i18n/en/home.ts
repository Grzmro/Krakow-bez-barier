import type { DistanceFrom } from "@/lib/nearby";
import type { Messages } from "../messages";

const placesWord = (n: number) => (n === 1 ? "place" : "places");
const verdictParts = (parts: [string, number][]) =>
  parts.length ? ` (${parts.map(([label, count]) => `${label}: ${count}`).join(", ")})` : "";

export const home: Messages["home"] = {
  title: "Map and list of places",
  skipToList: "Skip to the list",
  backToMap: "Back to the whole map",
  search: {
    label: "Search for a place",
    placeholder: "Where to?",
    suggestions: "Suggestions",
    clear: "Clear search",
    voice: {
      start: "Type by voice",
      listening: "Listening… speak now",
      processing: "Recognising speech…",
      notice: "Your browser recognises the speech and may send the recording to its provider's service (e.g. Google in Chrome); we store nothing.",
      errors: {
        "not-allowed": "No access to the microphone. Allow the microphone in your browser settings and try again.",
        "no-speech": "I didn't hear anything. Press the microphone and say what you're looking for.",
        network: "Speech recognition needs the internet. Check your connection or type your query.",
        other: "Speech couldn't be recognised. Try again or type your query.",
      },
    },
  },
  command: {
    applied: (what) => `Showing: ${what}, nearest first`,
    unknownTitle: "I didn't understand that command.",
    unknownHint: "Try: “nearest toilet”, “pharmacy near me” or “lift near me”.",
  },
  categoriesLabel: "Categories",
  categoryAll: "Everything",
  filtersLabel: "Feature filters",
  filters: {
    step_free: "Step-free",
    lift: "Lift",
    toilet_accessible: "Accessible toilet",
    bench: "Benches",
    disabled_parking: "Disabled parking",
    changing_table: "Changing table",
  },
  showUnknown: "Also show places with no data",
  map: {
    label: "Map of places. Arrow keys move the view, plus and minus change the zoom. The list has the same places.",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    sources: "Map sources",
    sourcesLabel: "Information about the map sources",
    unavailable: "The map isn't available in this browser. All places are in the list.",
    cluster: (n, parts) => `Group: ${n} ${placesWord(n)}${verdictParts(parts)}`,
    zoomedToCluster: (n, parts) => `Zoomed in: ${n} ${placesWord(n)}${verdictParts(parts)}`,
    inView: (n) => `In view: ${n} ${placesWord(n)}.`,
    pin: (name, category, status) => [name, category, status].filter(Boolean).join(" · "),
  },
  quick: {
    label: "Quick actions",
    actions: {
      toilet: { label: "Nearest toilet", result: "Nearest accessible toilet" },
      rest: { label: "Place to rest", result: "Nearest place with a bench" },
      lift: { label: "Nearest lift", result: "Nearest place with a lift" },
      pharmacy: { label: "Nearest pharmacy", result: "Nearest step-free pharmacy" },
      transit_stop: { label: "Nearest stop", result: "Nearest step-free stop" },
    },
    soon: "soon",
    unavailable: {
      awaitingTransitData:
        "We will show stops once the ZTP data is switched on (licence pending). This does not mean there are no stops nearby.",
    },
    needLocation: "To find the nearest one, turn on “Near me” or choose a district.",
    searching: "Looking for the nearest one…",
    none: (result) => `${result}: none nearby (about 2 km) in the data.`,
    noneHint: "Places without accessibility data don't count as accessible. You can show them in the list below.",
    found: (result, name, distance) => `${result}: ${name}, ${distance}`,
    guide: "Guide me",
    details: "Details",
    loadingFacts: "Loading facts…",
  },
  list: {
    label: "List of places",
    stow: { hide: "Hide the list", show: "Show the list" },
    results: (n: number) => `${n} ${placesWord(n)}`,
    announce: (n: number) => (n === 0 ? "No places found" : `Found ${n} ${placesWord(n)}`),
    loading: "Searching for places…",
    error: "Couldn't load places.",
    retry: "Try again",
    empty: "No places for this search.",
    emptyHint: "Try a wider search: no name, category or filters.",
    searchWider: "Search all of Kraków",
    licenceHold: {
      transit_stop: "Stop data is waiting for the ZTP licence to be confirmed.",
      parking: "Parking space data is waiting for the ZDMK licence to be confirmed.",
      link: "About the data",
    },
    more: (shown, total) => `Show more places (${shown} of ${total})`,
    noFeatureMatch: (features: string) =>
      `No place in the results has this in its data: ${features}. Often nobody has described it yet — no data doesn't mean the facility is missing.`,
    distance: (m: number, from: DistanceFrom = "centre") =>
      `${m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`} ${
        from === "user" ? "from you" : from === "chosen" ? "from the chosen point" : "from the Main Square"
      }`,
  },
};
