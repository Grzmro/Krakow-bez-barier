import type { Messages } from "../messages";

const placesWord = (n: number) => (n === 1 ? "place" : "places");

export const home: Messages["home"] = {
  title: "Map and list of places",
  skipToList: "Skip to the list",
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
  },
  list: {
    label: "List of places",
    results: (n: number) => `${n} ${placesWord(n)}`,
    announce: (n: number) => (n === 0 ? "No places found" : `Found ${n} ${placesWord(n)}`),
    loading: "Searching for places…",
    error: "Couldn't load places.",
    retry: "Try again",
    empty: "No places for this search.",
    emptyHint: "Try a wider search: no name, category or filters.",
    searchWider: "Search all of Kraków",
    distance: (m: number, fromUser = false) =>
      `${m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`} ${fromUser ? "from you" : "from the Main Square"}`,
  },
};
