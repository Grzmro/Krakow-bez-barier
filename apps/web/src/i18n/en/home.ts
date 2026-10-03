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
    unavailable: "The map isn't available in this browser. All places are in the list.",
    cluster: (n, parts) => `Group: ${n} ${placesWord(n)}${verdictParts(parts)}`,
    zoomedToCluster: (n, parts) => `Zoomed in: ${n} ${placesWord(n)}${verdictParts(parts)}`,
    inView: (n) => `In view: ${n} ${placesWord(n)}.`,
    pin: (name, category, status) => [name, category, status].filter(Boolean).join(" · "),
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
    noFeatureMatch: (features: string) =>
      `No place in the results has this in its data: ${features}. Often nobody has described it yet — no data doesn't mean the facility is missing.`,
    distance: (m: number, from: DistanceFrom = "centre") =>
      `${m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`} ${
        from === "user" ? "from you" : from === "chosen" ? "from the chosen point" : "from the Main Square"
      }`,
  },
};
