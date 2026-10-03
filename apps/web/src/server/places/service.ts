import type {
  AccessibilityAttribute,
  AccessibilityFact,
  GetPlaceQuery,
  ListPlacesQuery,
  Outage,
  Place,
  PlaceList,
  PlaceSummary,
  ResolvedAttribute,
  Source,
  SummaryChip,
} from "@krakow-bez-barier/contracts";
import { categories } from "@krakow-bez-barier/contracts";
import { openapiDocument } from "@krakow-bez-barier/contracts/openapi";
import { defaultLocale, type Locale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";
import { FEATURE_ATTRIBUTES, featureState } from "@/domain/features";
import { matchProfile } from "@/domain/matcher";
import { thresholdsFor } from "@/domain/profiles";
import { isStale, resolveAttribute } from "@/domain/resolver";
import { activeOutagesByPlace } from "@/server/outages/service";
import { pendingReportsByAttribute, type ReportsStore } from "@/server/reports";
import {
  createDbPlaceRepository,
  normalizeText,
  type FactRecord,
  type PlaceHit,
  type PlaceRecord,
  type PlaceRepository,
  type SourceRecord,
} from "./repository";

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

/** `locale`: language of chip labels and verdict reasons — the one the caller picked, Polish by default. */
export type PlacesDeps = { repository?: PlaceRepository; now?: Date; locale?: Locale };

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
        ? { photoUrl: evidence?.photoUrl ?? null, comment: evidence?.comment ?? null, confirmations: record.confirmations }
        : null,
    status: record.status,
    stale: false,
  };
  return { ...fact, stale: FAILED_REFRESH.has(record.source.refreshStatus) || isStale(fact, now) };
}

function toSource(record: SourceRecord): Source {
  return {
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
  };
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

function summaryChips(attributes: ResolvedAttribute[], extra: AccessibilityAttribute[], locale: Locale): SummaryChip[] {
  const wanted = new Set([...ALWAYS_SUMMARIZED, ...extra]);
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

/**
 * Searches places (text on name and address, category, bbox in PostGIS; with `near`, nearest first from that point), resolves their facts and applies
 * feature filters: a place passes a filter only when the feature is known to be there; with
 * `includeUnknown`, places we can't say about pass too (`features[].state` says which, and every
 * attribute behind the feature gets a chip, "brak danych" included), but a feature known to be missing
 * never does. Adds a profile verdict when `profile` is set.
 */
export async function listPlaces(query: ListPlacesQuery, deps: PlacesDeps = {}): Promise<PlaceList> {
  const { repository = createDbPlaceRepository(), now = new Date(), locale = defaultLocale } = deps;
  const bbox = readBbox(query.bbox);
  const unknownCategory = query.category?.find((id) => !categories.some((c) => c.id === id));
  if (unknownCategory) {
    throw new InvalidQueryError("query.category", `names "${unknownCategory}", which is not a configured category`);
  }
  const near = readNear(query.near);
  const text = query.q ? normalizeText(query.q) : "";
  const features = [...new Set(query.feature ?? [])];
  const thresholds = thresholdsFor(query);
  const limit = query.limit ?? 25;

  // Feature filters need resolved facts, so every candidate is resolved before paging (see docs/architecture.md).
  const hiddenByDefault = categories.filter((c) => c.hiddenByDefault).map((c) => c.id);
  const candidates = await repository.searchPlaces({
    text: text || undefined,
    categories: query.category,
    excludeCategories: hiddenByDefault,
    bbox,
    near,
  });
  const factsByPlace = Map.groupBy(await repository.activeFacts(candidates.map((p) => p.id)), (f) => f.placeId);

  const matching = candidates
    .map((place) => {
      const records = factsByPlace.get(place.id) ?? [];
      const attributes = resolvePlace(records, now);
      const matches = features.map((feature) => ({ feature, state: featureState(attributes, feature) }));
      return { place, records, attributes, matches };
    })
    .filter(({ matches }) =>
      query.includeUnknown ? matches.every((m) => m.state !== "absent") : matches.every((m) => m.state === "met"),
    )
    .sort((a, b) => (near ? byDistanceThenId(distanceOf(a.place), distanceOf(b.place)) : byNameThenId(a.place, b.place)));

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
    summary: summaryChips(attributes, featureAttributes, locale),
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

  const records = await repository.activeFacts([place.id]);
  const attributes = resolvePlace(records, now);
  const thresholds = thresholdsFor(query);
  const sources = [...new Map(records.map((r) => [r.source.id, r.source])).values()].map(toSource);
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
