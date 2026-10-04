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
    categorySuggestion: (label: string) => `Category: ${label}`,
    clear: "Clear search",
    route: {
      prompt: (name: string) => `Do you want to go to: ${name}?`,
      button: "Plan route",
      aria: (name: string) => `Plan a route to: ${name}`,
    },
    voice: {
      start: "Type by voice",
      listening: "Listening… speak now",
      processing: "Recognising speech…",
      notice: "Your browser recognises the speech (it may use a service such as Google). We store nothing.",
      notAllowedApp:
        "No access to the microphone. Turn it on in Settings → Apps → Kraków bez barier → Permissions → Microphone. Searching by text still works.",
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
  categoryCleared: "Showing all categories",
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
  confirm: {
    label: "Confirm your choices",
    summary: (choices: string) => `Chosen: ${choices}`,
    nearby: "near me",
    show: "Show results",
    showCount: (n: number) => `Show results (${n})`,
    clear: "Clear choices and return to the map",
    countAnnounce: (n: number) => (n === 0 ? "No place matches your choices" : `${n} ${placesWord(n)} match your choices`),
  },
  map: {
    label: "Map of places. Arrow keys move the view, plus and minus change the zoom. The list has the same places.",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    locate: "Show my location",
    locating: "Finding your position…",
    located: "The map shows your position.",
    here: "You are here",
    sources: "Map sources",
    sourcesLabel: "Information about the map sources",
    unavailable: "The map isn't available in this browser. All places are in the list.",
    cluster: (n, parts) => `Group: ${n} ${placesWord(n)}${verdictParts(parts)}`,
    zoomedToCluster: (n, parts) => `Zoomed in: ${n} ${placesWord(n)}${verdictParts(parts)}`,
    inView: (n) => `In view: ${n} ${placesWord(n)}.`,
    pinsCut: (shown, total) =>
      `The map shows ${shown} of ${total} places. Zoom in to see the rest.`,
    pin: (name, category, status) => [name, category, status].filter(Boolean).join(" · "),
  },
  quick: {
    label: "Quick actions",
    actions: {
      toilet: { label: "Nearest toilet", result: "Nearest accessible toilet" },
      rest: { label: "Place to rest", result: "Nearest place with a bench" },
      lift: { label: "Nearest lift", result: "Nearest place with a lift" },
      pharmacy: { label: "Nearest pharmacy", result: "Nearest step-free pharmacy" },
      transit_stop: { label: "Nearest stop", result: "Nearest stop" },
    },
    needLocation: "To find the nearest one, turn on “Near me” or choose a district.",
    searching: "Looking for the nearest one…",
    none: (result) => `${result}: none nearby (about 2 km) in the data`,
    noneHint: "Places without data don't count as accessible. You can show them in the list below.",
    found: (result, name, distance) => `${result}: ${name}, ${distance}`,
    foundStale: (result, name, distance, outdated) => `${result}: ${name}, ${distance}. ${outdated}`,
    maybeOutdated: "May be outdated",
    staleHint: "Only outdated data says so (over a year old). It may have changed — check the details or ask on site.",
    guide: "Guide me",
    details: "Details",
    loadingFacts: "Loading facts…",
  },
  list: {
    label: "List of places",
    start: { summary: "Nearest places", hint: "Type a name and press Enter. Or pick a category and “Show results”.", nearYou: "Nearest to you", nearChosen: "Nearest to the point you chose", nearCentre: "Nearest to the Main Square (no location)", empty: "No places nearby." },
    stow: { hide: "Hide the list", show: "Show the list" },
    filtersJump: "Filters and profile",
    results: (n: number) => `${n} ${placesWord(n)}`,
    firstOf: (shown: number, total: number) => `List: first ${shown} of ${total} ${placesWord(total)}`,
    announcePartial: (shown: number, total: number) =>
      `${total} ${placesWord(total)} in view, the list has the first ${shown}. “Show more” loads the rest`,
    announcePartialFound: (shown: number, total: number) =>
      `Found ${total} ${placesWord(total)}, the list has the first ${shown}. “Show more” loads the rest`,
    announce: (n: number) => (n === 0 ? "No places found" : `Found ${n} ${placesWord(n)}`),
    loading: "Searching for places…",
    error: "Couldn't load places.",
    retry: "Try again",
    empty: "No places for this search.",
    emptyHint: "Try a wider search: no name, category or filters.",
    emptyHintKeepName: "Try a wider search: the same name, without the category, filters or area.",
    searchWider: "Search all of Kraków",
    licenceHold: {
      parking: "We'll show parking spaces once the ZDMK licence is confirmed.",
      link: "About the data",
    },
    more: (shown, total) => `Show more places (${shown} of ${total})`,
    noFeatureMatch: (features: string) =>
      `No places with: ${features}. Often nobody has described it — no data doesn't mean the facility is missing.`,
    distance: (m: number, from: DistanceFrom = "centre") =>
      `${m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`} ${
        from === "user" ? "from you" : from === "chosen" ? "from the chosen point" : "from the Main Square"
      }`,
  },
};
