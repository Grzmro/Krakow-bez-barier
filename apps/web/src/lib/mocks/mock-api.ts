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
import { FEATURE_ATTRIBUTES, featureState } from "@/domain/features";
import { matchProfile } from "@/domain/matcher";
import { thresholdsFor } from "@/domain/profiles";
import { defaultLocale, type Locale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";
import { byDistance } from "@/lib/nearby";

// In-browser stand-in for the places API, for tests and the demo recording only (NEXT_PUBLIC_API_MOCK=true),
// built only from the spec's `examples`. Supports `q`, `category`, `feature` + `includeUnknown`, `bbox`, `near` (nearest first, one page) and the profile
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

/**
 * The examples' chip labels are written in Polish. In another language, a labelled chip of a place with facts is
 * labelled like the API does; other chips lose the label, so the list falls back to the attribute name and state.
 */
function localizedChips(summary: PlaceSummary, locale: Locale): PlaceSummary {
  if (locale === defaultLocale) return summary;
  const place = PLACES.find((p) => p.id === summary.id);
  const chip = messagesFor(locale).summary.chip;
  return {
    ...summary,
    summary: summary.summary.map(({ attribute, state, status, label }) => {
      const resolved = label ? place?.attributes.find((a) => a.attribute === attribute) : undefined;
      return resolved
        ? { attribute, state, status, label: chip(attribute, resolved.state, resolved.value) }
        : { attribute, state, status };
    }),
  };
}

export function mockListPlaces(query: ListPlacesQuery = {}, locale: Locale = defaultLocale): PlaceList {
  const thresholds = thresholdsFor(query);
  const items = SUMMARIES.filter((s) => (query.q ? matchesText(s, query.q) : true))
    .filter((s) => (query.category?.length ? query.category.includes(s.category) : !HIDDEN_BY_DEFAULT.has(s.category)))
    .filter((s) => inBbox(s, query.bbox))
    .map((s) => withFeatures(s, query))
    .filter((s) => hasFeatures(s, query))
    .map((s) => ({
      ...localizedChips(s, locale),
      verdict: thresholds ? matchProfile(factsOf(s), thresholds, locale) : null,
    }));
  const [lon, lat] = query.near ?? [];
  const ordered = lon === undefined || lat === undefined ? items : byDistance(items, [lon, lat]).map(({ place }) => place);
  return { items: ordered, nextCursor: null, total: ordered.length };
}

export function mockGetPlace(id: string, query: GetPlaceQuery = {}, locale: Locale = defaultLocale): Place | null {
  const place = PLACES.find((p) => p.id === id);
  if (!place) return null;
  const thresholds = thresholdsFor(query);
  return { ...place, verdict: thresholds ? matchProfile(place, thresholds, locale) : null };
}
