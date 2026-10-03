import {
  responseExamples,
  type GetPlaceQuery,
  type ListPlacesQuery,
  type Place,
  type PlaceList,
  type PlaceSummary,
} from "@krakow-bez-barier/contracts";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/profile/thresholds";
import { mockVerdict } from "./mock-verdict";

// TODO(KBB-28): in-browser stand-in for the places API, built only from the spec's `examples`.
// Supports `q`, `category` and the profile parameters; feature filters and bbox are not mocked.

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

const SUMMARIES: PlaceSummary[] = uniqueById([
  ...responseExamples.listPlaces[200].withUnknown.items,
  ...PLACES.map(toSummary),
]);

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

function thresholdsOf(query: GetPlaceQuery | ListPlacesQuery): Thresholds | null {
  if (!query.profile) return null;
  const preset = DEFAULT_THRESHOLDS[query.profile];
  return {
    maxThresholdCm: query.maxThresholdCm ?? preset.maxThresholdCm,
    minDoorWidthCm: query.minDoorWidthCm ?? preset.minDoorWidthCm,
    requireStepFree: query.requireStepFree ?? preset.requireStepFree,
    requireLift: query.requireLift ?? preset.requireLift,
    requireAccessibleToilet: query.requireAccessibleToilet ?? preset.requireAccessibleToilet,
    requireSmoothSurface: query.requireSmoothSurface ?? preset.requireSmoothSurface,
    requireChangingTable: query.requireChangingTable ?? preset.requireChangingTable,
  };
}

const factsOf = (summary: PlaceSummary) => PLACES.find((p) => p.id === summary.id) ?? { attributes: [] };

export function mockListPlaces(query: ListPlacesQuery = {}): PlaceList {
  const thresholds = thresholdsOf(query);
  const items = SUMMARIES.filter((s) => (query.q ? matchesText(s, query.q) : true))
    .filter((s) => (query.category?.length ? query.category.includes(s.category) : true))
    .map((s) => ({ ...s, verdict: thresholds ? mockVerdict(factsOf(s), thresholds) : null }));
  return { items, nextCursor: null, total: items.length };
}

export function mockGetPlace(id: string, query: GetPlaceQuery = {}): Place | null {
  const place = PLACES.find((p) => p.id === id);
  if (!place) return null;
  const thresholds = thresholdsOf(query);
  return { ...place, verdict: thresholds ? mockVerdict(place, thresholds) : null };
}
