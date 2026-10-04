import type {
  AccessibilityAttribute,
  AccessibilityFact,
  GetPlaceQuery,
  ListPlacePointsQuery,
  ListPlacesQuery,
  Outage,
  Place,
  PlaceList,
  PlacePointList,
  PlaceSummary,
  ResolvedAttribute,
  Source,
  SummaryChip,
} from "@krakow-bez-barier/contracts";
import { categories, hiddenCategoryIds } from "@krakow-bez-barier/contracts";
import { openapiDocument } from "@krakow-bez-barier/contracts/openapi";
import { defaultLocale, type Locale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";
import { FEATURE_ATTRIBUTES, featureMatch } from "@/domain/features";
import { matchProfile } from "@/domain/matcher";
import { thresholdsFor } from "@/domain/profiles";
import { isStale, resolveAttribute } from "@/domain/resolver";
import { activeOutagesByPlace } from "@/server/outages/service";
import { pendingReportsByAttribute, type ReportsStore } from "@/server/reports";
import { currentSimulatedOutageIds } from "@/server/source-outages/service";
import { localizeSourceText, withSimulatedOutage } from "@/server/sources";
import {
  createDbPlaceRepository,
  type FactRecord,
  type PlaceHit,
  type PlaceRecord,
  type PlaceRepository,
  type SourceRecord,
} from "./repository";
import { searchTextAttempts } from "./search-query";

/** A query the spec accepts but the values don't make sense (e.g. an inverted bbox); answered with 400. */
export class InvalidQueryError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "InvalidQueryError";
  }
}

/**
 * `locale`: language of chip labels and verdict reasons — the one the caller picked, Polish by default.
 * `simulated`: sources under the demo outage switch (`SIMULATE_SOURCE_OUTAGE` or a moderator's), shown failed here as on
 * `GET /sources`; read with `currentSimulatedOutageIds` when not given.
 */
export type PlacesDeps = { repository?: PlaceRepository; now?: Date; locale?: Locale; simulated?: readonly string[] };

// Describe a route segment, not a place (see the spec's AccessibilityAttribute).
const ROUTE_ONLY: AccessibilityAttribute[] = ["stairs"];

// The vocabulary is the spec's enum; `Place.attributes` lists every place entry, unknown ones included.
const ATTRIBUTES = (
  (openapiDocument.components as { schemas: Record<string, { enum: string[] }> }).schemas.AccessibilityAttribute.enum as AccessibilityAttribute[]
).filter((attribute) => !ROUTE_ONLY.includes(attribute));

// Shown in every list row even without data, so "Brak danych" is explicit, not a missing chip.
const ALWAYS_SUMMARIZED: AccessibilityAttribute[] = ["step_count", "toilet_accessible"];

const FAILED_REFRESH = new Set<SourceRecord["refreshStatus"]>(["stale", "outage"]);

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function toFact(record: FactRecord, now: Date): AccessibilityFact {
  const { evidence } = record;
  const fact: AccessibilityFact = {
    id: record.id,
    attribute: record.attribute,
    value: record.value,
    unit: record.unit,
    source: {
      id: record.source.id,
      name: record.source.name,
      kind: record.source.kind,
      recordRef: record.sourceRecordRef || null,
    },
    fetchedAt: record.fetchedAt.toISOString(),
    observedAt: iso(record.observedAt),
    confirmedAt: iso(record.confirmedAt),
    reliability: record.reliability,
    evidence:
      evidence || record.confirmations > 0
        ? {
            photoUrl: evidence?.photoUrl ?? null,
            comment: evidence?.comment ?? null,
            ...(evidence?.url ? { url: evidence.url } : {}),
            confirmations: record.confirmations,
          }
        : null,
    status: record.status,
    stale: false,
  };
  return { ...fact, stale: FAILED_REFRESH.has(record.source.refreshStatus) || isStale(fact, now) };
}

function toSource(record: SourceRecord, locale: Locale, simulated: readonly string[]): Source {
  const source: Source = {
    id: record.id,
    name: record.name,
    kind: record.kind,
    license: record.license,
    attribution: record.attribution,
    url: record.url,
    refreshInterval: record.refreshInterval,
    refreshStatus: record.refreshStatus,
    lastSuccessAt: iso(record.lastSuccessAt),
    lastAttemptAt: iso(record.lastAttemptAt),
    statusNote: record.statusNote,
    isSample: record.isSample,
    simulatedOutage: simulated.includes(record.id),
  };
  return localizeSourceText(source, locale);
}

function withOutages(records: FactRecord[], now: Date, simulated: readonly string[], locale: Locale): FactRecord[] {
  if (!simulated.length) return records;
  return records.map((r) => ({ ...r, source: withSimulatedOutage(r.source, now, simulated, locale) }));
}

export function resolvePlace(records: FactRecord[], now: Date): ResolvedAttribute[] {
  const facts = records.map((r) => toFact(r, now));
  return ATTRIBUTES.map((attribute) => resolveAttribute(attribute, facts, now));
}

const isSample = (place: PlaceRecord, records: FactRecord[]) =>
  place.isSample || records.some((r) => r.source.isSample || r.reliability === "sample");

const address = (place: PlaceRecord) => ({
  street: place.street,
  houseNumber: place.houseNumber,
  postalCode: place.postalCode,
  city: place.city,
});

const location = (place: PlaceRecord) => ({ type: "Point" as const, coordinates: [place.location.x, place.location.y] });

function summaryChips(
  attributes: ResolvedAttribute[],
  extra: AccessibilityAttribute[],
  category: string,
  locale: Locale,
): SummaryChip[] {
  // A category with its own card (a stop) has no entrance or toilet to call unknown.
  const own = categories.find((c) => c.id === category)?.cardAttributes;
  const wanted = new Set([...ALWAYS_SUMMARIZED.filter((a) => !own || own.includes(a)), ...extra]);
  return attributes
    .filter((a) => a.state !== "unknown" || wanted.has(a.attribute))
    .map(({ attribute, state, status, value }) => ({
      attribute,
      state,
      status,
      label: messagesFor(locale).summary.chip(attribute, state, value),
    }));
}

type NameCursor = { name: string; id: string };
type Near = [number, number];
type NearCursor = { near: Near; distance: number; id: string };

const collator = new Intl.Collator("pl", { sensitivity: "base" });
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byNameThenId = (a: NameCursor, b: NameCursor) => collator.compare(a.name, b.name) || byId(a, b);
const byDistanceThenId = (a: { distance: number; id: string }, b: { distance: number; id: string }) =>
  a.distance - b.distance || byId(a, b);
const distanceOf = (place: PlaceHit) => ({ id: place.id, distance: place.distance ?? Number.POSITIVE_INFINITY });

const encode = (parts: unknown[]) => Buffer.from(JSON.stringify(parts)).toString("base64url");
const encodeNameCursor = ({ name, id }: NameCursor) => encode([name, id]);
const encodeNearCursor = ({ near, distance, id }: NearCursor) => encode(["near", near[0], near[1], distance, id]);

const notACursor = () => new InvalidQueryError("query.cursor", "is not a cursor returned in nextCursor for this query");

function parseCursor(cursor: string): unknown[] {
  try {
    const parts: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (Array.isArray(parts)) return parts;
  } catch {
    // falls through to the error below
  }
  throw notACursor();
}

/** A name-order cursor; one issued for a `near` list is refused. */
function decodeNameCursor(cursor: string): NameCursor {
  const [name, id, ...rest] = parseCursor(cursor);
  if (typeof name === "string" && typeof id === "string" && rest.length === 0) return { name, id };
  throw notACursor();
}

/** A distance-order cursor for exactly this `near` point; a name-order cursor, or one for another point, is refused. */
function decodeNearCursor(cursor: string, near: Near): NearCursor {
  const [kind, lon, lat, distance, id, ...rest] = parseCursor(cursor);
  if (
    kind === "near" &&
    lon === near[0] &&
    lat === near[1] &&
    typeof distance === "number" &&
    Number.isFinite(distance) &&
    distance >= 0 &&
    typeof id === "string" &&
    rest.length === 0
  ) {
    return { near, distance, id };
  }
  throw notACursor();
}

function readNear(near: number[] | undefined): Near | undefined {
  if (!near) return undefined;
  const [lon, lat] = near;
  if (!(lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90)) {
    throw new InvalidQueryError("query.near", "must be lon,lat within WGS84 bounds");
  }
  return [lon, lat];
}

function readBbox(bbox: number[] | undefined): [number, number, number, number] | undefined {
  if (!bbox) return undefined;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const lonOk = (v: number) => v >= -180 && v <= 180;
  const latOk = (v: number) => v >= -90 && v <= 90;
  if (![minLon, maxLon].every(lonOk) || ![minLat, maxLat].every(latOk) || minLon > maxLon || minLat > maxLat) {
    throw new InvalidQueryError("query.bbox", "must be minLon,minLat,maxLon,maxLat within WGS84 bounds");
  }
  return [minLon, minLat, maxLon, maxLat];
}

type SearchQuery = Pick<ListPlacesQuery, "q" | "category" | "feature" | "bbox" | "near" | "includeUnknown">;

/**
 * Searches places (text on name and address, category, bbox in PostGIS; with `near`, each hit carries its distance),
 * resolves their facts and applies feature filters: a place passes a filter only when the feature is known to be
 * there; with `includeUnknown`, places we can't say about pass too, but a feature known to be missing never does.
 * Shared by the list and the map points, so both always hold the same places.
 */
async function matchingPlaces(query: SearchQuery, deps: PlacesDeps) {
  const { repository = createDbPlaceRepository(), now = new Date(), locale = defaultLocale } = deps;
  const simulated = deps.simulated ?? (await currentSimulatedOutageIds());
  const bbox = readBbox(query.bbox);
  const unknownCategory = query.category?.find((id) => !categories.some((c) => c.id === id));
  if (unknownCategory) {
    throw new InvalidQueryError("query.category", `names "${unknownCategory}", which is not a configured category`);
  }
  const near = readNear(query.near);
  const attempts = query.q ? searchTextAttempts(query.q) : [];
  const features = [...new Set(query.feature ?? [])];

  // Feature filters need resolved facts, so every candidate is resolved before paging (see docs/architecture.md).
  const hiddenByDefault = hiddenCategoryIds(features);
  const search = (text?: string) =>
    repository.searchPlaces({ text, categories: query.category, excludeCategories: hiddenByDefault, bbox, near });
  let candidates = await search(attempts[0]);
  // Typed or dictated Polish rarely matches verbatim: retry without the lead-in, then de-inflected.
  for (const text of attempts.slice(1)) {
    if (candidates.length) break;
    candidates = await search(text);
  }
  const facts = withOutages(await repository.activeFacts(candidates.map((p) => p.id)), now, simulated, locale);
  const factsByPlace = Map.groupBy(facts, (f) => f.placeId);

  const matching = candidates
    .map((place) => {
      const records = factsByPlace.get(place.id) ?? [];
      const attributes = resolvePlace(records, now);
      const matches = features.map((feature) => featureMatch(attributes, feature, now));
      return { place, records, attributes, matches };
    })
    .filter(({ matches }) =>
      query.includeUnknown ? matches.every((m) => m.state !== "absent") : matches.every((m) => m.state === "met"),
    );
  return { matching, near, features, repository, now, locale };
}

/** Most points `GET /places/points` returns; `truncated` says when more matched. Mirrors the spec's `maxItems`. */
export const MAX_MAP_POINTS = 20_000;

// ~10 cm: plenty for a pin, and a third fewer bytes than a double's 15 digits.
const roundCoordinate = (value: number) => Math.round(value * 1e6) / 1e6;

/**
 * The places `listPlaces` would return for the same filters inside `bbox`, as light map points: id, name, category,
 * location and the profile verdict's state (with the same outages counted). No paging; at most `MAX_MAP_POINTS`, in id
 * order so a cut is stable.
 */
export async function listPlacePoints(query: ListPlacePointsQuery, deps: PlacesDeps = {}): Promise<PlacePointList> {
  const { matching, repository, now, locale } = await matchingPlaces(query, deps);
  const thresholds = thresholdsFor(query);
  const kept = matching.toSorted((a, b) => byId(a.place, b.place)).slice(0, MAX_MAP_POINTS);
  const outages = thresholds ? await outagesOf(repository, kept.map(({ place }) => place.id), now) : new Map<string, Outage[]>();
  return {
    items: kept.map(({ place, attributes }) => ({
      id: place.id,
      name: place.name,
      category: place.category,
      location: { type: "Point" as const, coordinates: [roundCoordinate(place.location.x), roundCoordinate(place.location.y)] },
      verdict: thresholds ? matchProfile({ attributes, outages: outages.get(place.id) }, thresholds, locale).state : null,
    })),
    total: matching.length,
    truncated: matching.length > kept.length,
  };
}

/**
 * Searches places (see `matchingPlaces`); with `near`, nearest first from that point, otherwise by name. With
 * `includeUnknown`, `features[].state` says which filters a place passed for lack of data, and every attribute behind
 * the feature gets a chip, "brak danych" included. Adds a profile verdict when `profile` is set.
 */
export async function listPlaces(query: ListPlacesQuery, deps: PlacesDeps = {}): Promise<PlaceList> {
  const found = await matchingPlaces(query, deps);
  const { near, features, repository, now, locale } = found;
  const thresholds = thresholdsFor(query);
  const limit = query.limit ?? 25;
  const matching = found.matching.sort((a, b) =>
    near ? byDistanceThenId(distanceOf(a.place), distanceOf(b.place)) : byNameThenId(a.place, b.place),
  );

  let remaining = matching;
  if (query.cursor && near) {
    const after = decodeNearCursor(query.cursor, near);
    remaining = matching.filter(({ place }) => byDistanceThenId(distanceOf(place), after) > 0);
  } else if (query.cursor) {
    const after = decodeNameCursor(query.cursor);
    remaining = matching.filter(({ place }) => byNameThenId(place, after) > 0);
  }
  const page = remaining.slice(0, limit);
  const outages = thresholds ? await outagesOf(repository, page.map(({ place }) => place.id), now) : new Map<string, Outage[]>();
  // entrance_level only ever proves step_free, so its missing data isn't worth a "brak danych" chip.
  const featureAttributes = features.flatMap((f) => FEATURE_ATTRIBUTES[f]).filter((a) => a !== "entrance_level");

  const items: PlaceSummary[] = page.map(({ place, records, attributes, matches }) => ({
    id: place.id,
    name: place.name,
    category: place.category,
    location: location(place),
    address: address(place),
    summary: summaryChips(attributes, featureAttributes, place.category, locale),
    ...(features.length ? { features: matches } : {}),
    verdict: thresholds ? matchProfile({ attributes, outages: outages.get(place.id) }, thresholds, locale) : null,
    isSample: isSample(place, records),
  }));

  const last = page.at(-1);
  return {
    items,
    nextCursor:
      remaining.length > page.length && last
        ? near
          ? encodeNearCursor({ near, ...distanceOf(last.place) })
          : encodeNameCursor(last.place)
        : null,
    total: matching.length,
  };
}

/**
 * Active outages per place. They only add barriers on top of the facts, so if they can't be read the places are
 * served without them rather than not at all.
 */
async function outagesOf(repository: PlaceRepository, placeIds: string[], now: Date): Promise<Map<string, Outage[]>> {
  try {
    return await activeOutagesByPlace((ids, since) => repository.recentOutages(ids, since), placeIds, now);
  } catch (error) {
    console.error("[places] outages could not be read", error);
    return new Map();
  }
}

function contact(place: PlaceRecord): Place["contact"] {
  // OSM websites are free text; only a parseable URL fits the spec's `format: uri`.
  const website = place.website && URL.canParse(place.website) ? place.website : null;
  if (!place.phone && !website && !place.email) return null;
  return { phone: place.phone, website, email: place.email };
}

/**
 * One place with every attribute resolved, all active facts behind each, its sources, its active outages and an
 * optional verdict that counts them.
 */
export async function getPlace(id: string, query: GetPlaceQuery = {}, deps: PlacesDeps = {}): Promise<Place | null> {
  const { repository = createDbPlaceRepository(), now = new Date(), locale = defaultLocale } = deps;
  const place = await repository.findPlace(id);
  if (!place) return null;
  const simulated = deps.simulated ?? (await currentSimulatedOutageIds());

  const records = withOutages(await repository.activeFacts([place.id]), now, simulated, locale);
  const attributes = resolvePlace(records, now);
  const thresholds = thresholdsFor(query);
  const sources = [...new Map(records.map((r) => [r.source.id, r.source])).values()].map((record) => toSource(record, locale, simulated));
  const outages = (await outagesOf(repository, [place.id], now)).get(place.id) ?? [];

  return {
    id: place.id,
    name: place.name,
    category: place.category,
    location: location(place),
    address: address(place),
    contact: contact(place),
    entranceHint: place.entranceHint,
    attributes,
    verdict: thresholds ? matchProfile({ attributes, outages }, thresholds, locale) : null,
    outages,
    sources,
    updatedAt: place.updatedAt.toISOString(),
    isSample: isSample(place, records),
  };
}

/**
 * Lists the reports awaiting moderation beside each attribute (`ResolvedAttribute.pendingReports`). They never change
 * the value, state, status or verdict; accepted and rejected reports drop out (an accepted one is a fact by then).
 * Comments are withheld: free text nobody has moderated yet is not published. If the reports can't be read, the card
 * is served without them — the resolved facts don't depend on the reports table.
 */
export async function withPendingReports(place: Place, store: ReportsStore): Promise<Place> {
  let pending: Awaited<ReturnType<typeof pendingReportsByAttribute>>;
  try {
    pending = await pendingReportsByAttribute(store, place.id);
  } catch (error) {
    console.error(`[places] pending reports for ${place.id} could not be read`, error);
    return place;
  }
  return {
    ...place,
    attributes: place.attributes.map((attribute) => ({
      ...attribute,
      pendingReports: (pending.get(attribute.attribute) ?? []).map((report) => ({ ...report, comment: null })),
    })),
  };
}
