import {
  categories,
  responseExamples,
  type FeatureFilter,
  type FeatureMatch,
  type GetPlaceQuery,
  type ListPlacesQuery,
  type Place,
  type PlaceList,
  type PlaceSummary,
} from "@krakow-bez-barier/contracts";
import { FEATURE_ATTRIBUTES, featureState } from "@/server/domain/features";
import { matchProfile } from "@/server/domain/matcher";
import { thresholdsFor } from "@/server/domain/profiles";

// TODO(KBB-46): delete this layer once the front runs on the real places API by default.
// In-browser stand-in for the places API (used while NEXT_PUBLIC_API_MOCK is on), built only from the
// spec's `examples`. Supports `q`, `category`, `feature` + `includeUnknown`, `bbox` and the profile
// parameters; verdicts come from the same `matchProfile` the API uses.

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.id) && seen.add(item.id));
}

const PLACES: Place[] = uniqueById(Object.values(responseExamples.getPlace[200]));

function toSummary(place: Place): PlaceSummary {
  const { id, name, category, location, address, isSample } = place;
  const summary = place.attributes.map(({ attribute, state, status }) => ({ attribute, state, status }));
  return { id, name, category, location, address, summary, verdict: null, isSample };
}

// List examples first: their chips carry the human-written labels the list shows.
const SUMMARIES: PlaceSummary[] = uniqueById([
  ...Object.values<PlaceList>(responseExamples.listPlaces[200]).flatMap((list) => list.items),
  ...PLACES.map(toSummary),
]);

function inBbox(summary: PlaceSummary, bbox?: number[]) {
  if (bbox?.length !== 4) return true;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const [lon, lat] = summary.location.coordinates;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

const factsOf = (summary: PlaceSummary) => PLACES.find((p) => p.id === summary.id) ?? { attributes: [] };

// List-only examples have no facts; their hand-written chips mark only present features as known.
function stateFromChips(summary: PlaceSummary, feature: FeatureFilter): FeatureMatch["state"] {
  const chips = summary.summary.filter((chip) => FEATURE_ATTRIBUTES[feature].includes(chip.attribute));
  if (chips.some((chip) => chip.state === "known")) return "met";
  return chips.some((chip) => chip.state === "conflict") ? "conflict" : "unknown";
}

/** Answers each feature filter from the example's facts, like the API does. */
function withFeatures(summary: PlaceSummary, query: ListPlacesQuery): PlaceSummary {
  if (!query.feature?.length) return summary;
  const place = PLACES.find((p) => p.id === summary.id);
  const features = query.feature.map((feature) => ({
    feature,
    state: place ? featureState(place.attributes, feature) : stateFromChips(summary, feature),
  }));
  return { ...summary, features };
}

/** Feature filters hide places that don't have every feature by known data, unless `includeUnknown`. */
function hasFeatures(summary: PlaceSummary, query: ListPlacesQuery) {
  const states = summary.features?.map((match) => match.state) ?? [];
  return query.includeUnknown ? !states.includes("absent") : states.every((state) => state === "met");
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll("ł", "l");

function matchesText(summary: PlaceSummary, q: string) {
  const haystack = [summary.name, summary.address?.street, summary.address?.houseNumber].filter(Boolean).join(" ");
  return normalize(haystack).includes(normalize(q.trim()));
}

const HIDDEN_BY_DEFAULT = new Set(categories.filter((c) => c.hiddenByDefault).map((c) => c.id));

export function mockListPlaces(query: ListPlacesQuery = {}): PlaceList {
  const thresholds = thresholdsFor(query);
  const items = SUMMARIES.filter((s) => (query.q ? matchesText(s, query.q) : true))
    .filter((s) => (query.category?.length ? query.category.includes(s.category) : !HIDDEN_BY_DEFAULT.has(s.category)))
    .filter((s) => inBbox(s, query.bbox))
    .map((s) => withFeatures(s, query))
    .filter((s) => hasFeatures(s, query))
    .map((s) => ({ ...s, verdict: thresholds ? matchProfile(factsOf(s), thresholds) : null }));
  return { items, nextCursor: null, total: items.length };
}

export function mockGetPlace(id: string, query: GetPlaceQuery = {}): Place | null {
  const place = PLACES.find((p) => p.id === id);
  if (!place) return null;
  const thresholds = thresholdsFor(query);
  return { ...place, verdict: thresholds ? matchProfile(place, thresholds) : null };
}
