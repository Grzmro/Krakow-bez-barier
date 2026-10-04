import {
  categories as configuredCategories,
  type CategoryConfig,
  type FactEntrance,
  type FactValue,
  type OsmTagRule,
} from "@krakow-bez-barier/contracts";
import type { MappedFact, MappedPlace, MapResult } from "../adapter";

export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  version?: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  /** The copy the element was read from when not the live API, e.g. `geofabrik-2026-10-02`. */
  via?: string;
  /** A relation's members, read only for relations that name their members (`stop_area`). */
  members?: { type: "node" | "way" | "relation"; ref: number }[];
  /** Name of the naming relation (`stop_area`) the element belongs to, set by `prepareOsmElements`. */
  relationName?: string;
  /** The place's `entrance=*` node whose facts it takes, set by `attachEntrances`. */
  entrance?: OsmElement;
  /** Entrances were read for this run (see `MappedPlace.entrancesChecked`). */
  entrancesChecked?: boolean;
};

/**
 * OSM `entrance=*` values we attach to a place, and the kind each one is. Exits, garages, stairwells and staff-only
 * service doors are left out: they say nothing about how a visitor gets in.
 */
export const ENTRANCE_KINDS: Readonly<Record<string, FactEntrance>> = {
  main: "main",
  secondary: "secondary",
  shop: "shop",
  yes: "unspecified",
};

/** Tags of an entrance node that can give a fact; an entrance without any of them is not read. */
export const ENTRANCE_TAGS = [
  "wheelchair",
  "door:width",
  "entrance:width",
  "width",
  "step_count",
  "ramp",
  "ramp:wheelchair",
  "automatic_door",
] as const;

const bool = (boolean: boolean): FactValue => ({ kind: "boolean", boolean });
const num = (number: number, unit: "cm" | "count" | "pct"): FactValue => ({ kind: "number", number, unit });

/**
 * "0.9 m", "90 cm" → centimetres. A bare number is only read as metres when it is below 10
 * (mappers also write bare centimetres, which we cannot tell apart above that); null otherwise.
 */
export function parseCentimetres(raw: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(cm|m)?\s*$/i.exec(raw);
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  const unit = m[2]?.toLowerCase();
  if (unit === "cm") return value;
  if (unit === "m" || value < 10) return Math.round(value * 100 * 100) / 100;
  return null;
}

const inRange = (cm: number, min: number, max: number) => cm >= min && cm <= max;

const COUNT = /^\d{1,3}$/;

function parsePercent(raw: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*%\s*$/.exec(raw);
  return m ? Number(m[1].replace(",", ".")) : null;
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const LEVEL_PART = /^\s*(-?\d+(?:\.\d+)?)(?:\s*-\s*(-?\d+(?:\.\d+)?))?\s*$/;

/**
 * OSM `level` of a venue ("0", "1", "-1", "0;1", "0-2") → storeys a visitor may need to reach, counting the
 * ground floor the building is entered from: "0" → 1, "1" or "-1" → 2, "0;2" → 3. Null when unreadable.
 */
export function storeysFromLevel(raw: string): number | null {
  const levels: number[] = [];
  for (const part of raw.split(";")) {
    const m = LEVEL_PART.exec(part);
    if (!m) return null;
    levels.push(Number(m[1]));
    if (m[2] !== undefined) levels.push(Number(m[2]));
  }
  const top = Math.ceil(Math.max(0, ...levels));
  const bottom = Math.floor(Math.min(0, ...levels));
  return top - bottom + 1;
}

/** Venues that usually fill their whole building, so the building's height is the venue's own. */
const WHOLE_BUILDING_VENUES: Readonly<Record<string, readonly string[]>> = {
  tourism: ["museum", "hotel", "hostel", "guest_house", "gallery"],
  amenity: ["theatre", "cinema", "library"],
};

const fillsBuilding = (tags: Record<string, string>) =>
  Object.entries(WHOLE_BUILDING_VENUES).some(([key, values]) => tags[key] !== undefined && values.includes(tags[key]));

/** `osm:node/1@v5`, or `osm:node/1@v5;geofabrik-2026-10-02` for an element read from an extract. */
export function recordRef(el: OsmElement): string {
  const suffix = [el.version ? `v${el.version}` : null, el.via ?? null].filter(Boolean).join(";");
  return `osm:${el.type}/${el.id}${suffix ? `@${suffix}` : ""}`;
}

export const matchesRule = (tags: Record<string, string>, rule: OsmTagRule) =>
  tags[rule.key] !== undefined && rule.values.includes(tags[rule.key]) && (!rule.requires || tags[rule.requires] !== undefined);

/** The first category with a rule the tags match, and that rule. */
export function categoryOf(tags: Record<string, string>, categories: readonly CategoryConfig[]) {
  for (const category of categories) {
    const rule = category.osm.find((r) => matchesRule(tags, r));
    if (rule) return { category, rule };
  }
  return null;
}

type AddFact = (attribute: MappedFact["attribute"], value: FactValue, comment?: string) => void;

function wheelchairFact(tags: Record<string, string>, add: AddFact, skipped: string[]) {
  if (tags.wheelchair === undefined) return;
  if (["yes", "limited", "no"].includes(tags.wheelchair)) {
    add("wheelchair_overall", { kind: "text", text: tags.wheelchair }, tags["wheelchair:description"]);
  } else skipped.push(`wheelchair=${tags.wheelchair}`);
}

function rampFact(tags: Record<string, string>, add: AddFact, skipped: string[]) {
  const v = tags["ramp:wheelchair"];
  if (v === "yes" || v === "no") add("ramp", bool(v === "yes"));
  else if (v !== undefined) skipped.push(`ramp:wheelchair=${v}`);
  // A bare `ramp=yes` may be a rail for bikes or prams only, so it says nothing about a wheelchair ramp; `ramp=no` does.
  if (v === undefined && tags.ramp !== undefined) {
    if (tags.ramp === "no") add("ramp", bool(false));
    else skipped.push(`ramp=${tags.ramp}`);
  }
}

function stepCountFact(tags: Record<string, string>, add: AddFact, skipped: string[]) {
  if (tags.step_count === undefined) return;
  if (COUNT.test(tags.step_count)) add("step_count", num(Number(tags.step_count), "count"));
  else skipped.push(`step_count=${tags.step_count}`);
}

/** The first readable width among `keys`, in the range of a door. */
function doorWidthFact(tags: Record<string, string>, keys: readonly string[], add: AddFact, skipped: string[]) {
  let added = false;
  for (const tag of keys) {
    if (tags[tag] === undefined) continue;
    const cm = parseCentimetres(tags[tag]);
    if (cm === null || !inRange(cm, 30, 300)) skipped.push(`${tag}=${tags[tag]}`);
    else if (!added) {
      add("door_width_cm", num(cm, "cm"));
      added = true;
    }
  }
}

/** `automatic_door=yes|motion|button|continuous|…` opens by itself; `no` does not. */
const AUTOMATIC_DOORS = new Set(["yes", "motion", "button", "continuous", "slowdown_button", "floor"]);

/**
 * Facts of one `entrance=*` node, marked with its kind and carrying its own record ref and check date. An entrance of a
 * kind we don't attach gives none.
 */
export function entranceFacts(entrance: OsmElement, skipped: string[]): MappedFact[] {
  const tags = entrance.tags ?? {};
  const kind = ENTRANCE_KINDS[tags.entrance ?? ""];
  if (!kind) return [];
  const ref = recordRef(entrance);
  const observedAt = parseDate(tags.check_date);
  const facts: MappedFact[] = [];
  const add: AddFact = (attribute, value, comment) =>
    facts.push({ attribute, value, recordRef: ref, observedAt, evidence: comment ? { comment } : null, entrance: kind });
  wheelchairFact(tags, add, skipped);
  rampFact(tags, add, skipped);
  stepCountFact(tags, add, skipped);
  doorWidthFact(tags, ["door:width", "entrance:width", "width"], add, skipped);
  if (tags.automatic_door !== undefined) {
    if (tags.automatic_door === "no") add("automatic_door", bool(false));
    else if (AUTOMATIC_DOORS.has(tags.automatic_door)) add("automatic_door", bool(true));
    else skipped.push(`automatic_door=${tags.automatic_door}`);
  }
  return facts;
}

/**
 * Maps one OSM element to a place with facts. A missing tag yields no fact; a tag whose value
 * does not fit the vocabulary is skipped and reported, never guessed.
 */
export function mapOsmElement(el: OsmElement, categories: readonly CategoryConfig[] = configuredCategories): MapResult {
  const tags = el.tags ?? {};
  const skipped: string[] = [];
  const matched = categoryOf(tags, categories);
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!matched || lat === undefined || lon === undefined) return { place: null, skipped };
  const { category, rule } = matched;
  const unnamedName = (rule.nameFromRelation ? el.relationName : undefined) ?? rule.unnamedName ?? category.unnamedName;
  if (!tags.name && !unnamedName) return { place: null, skipped: ["unnamed place"] };

  const ref = recordRef(el);
  const observedAt = parseDate(tags.check_date);
  const facts: MappedFact[] = [];
  const add: AddFact = (attribute, value, comment) =>
    facts.push({
      attribute,
      value,
      recordRef: ref,
      observedAt,
      evidence: comment ? { comment } : null,
    });
  const triState = (tag: string, attribute: MappedFact["attribute"]) => {
    const v = tags[tag];
    if (v === undefined) return;
    if (v === "yes") add(attribute, bool(true));
    else if (v === "no") add(attribute, bool(false));
    else skipped.push(`${tag}=${v}`);
  };

  wheelchairFact(tags, add, skipped);
  triState("toilets:wheelchair", "toilet_accessible");
  triState("changing_table", "changing_table");
  triState("bench", "bench");
  // Bits of the way keep to what routes read: a kerb known only by its tactile paving stays out until a route needs it.
  if (!category.onRoutes) {
    triState("tactile_paving", "tactile_paving");
    triState("shelter", "shelter");
  }
  triState("elevator", "lift");
  rampFact(tags, add, skipped);
  stepCountFact(tags, add, skipped);
  doorWidthFact(tags, ["door:width", "entrance:width"], add, skipped);

  if (tags["kerb:height"] !== undefined) {
    const cm = parseCentimetres(tags["kerb:height"]);
    if (cm === null || !inRange(cm, 0, 50)) skipped.push(`kerb:height=${tags["kerb:height"]}`);
    else add("kerb_height_cm", num(cm, "cm"));
  } else if (tags.kerb === "flush") {
    add("kerb_height_cm", num(0, "cm"));
  } else if (tags.kerb !== undefined) {
    skipped.push(`kerb=${tags.kerb}`);
  }

  if (tags.incline !== undefined) {
    const pct = parsePercent(tags.incline);
    if (pct === null) skipped.push(`incline=${tags.incline}`);
    else add("incline_pct", num(pct, "pct"));
  }

  for (const tag of ["surface", "smoothness"] as const) {
    if (tags[tag] !== undefined) add(tag, { kind: "text", text: tags[tag] });
  }

  if (tags["capacity:disabled"] !== undefined) {
    const raw = tags["capacity:disabled"];
    if (raw === "yes" || raw === "no") add("disabled_parking", bool(raw === "yes"));
    else if (COUNT.test(raw)) add("disabled_parking", bool(Number(raw) > 0));
    else skipped.push(`capacity:disabled=${tags["capacity:disabled"]}`);
  }

  // The element is the feature itself: a bench, a disabled parking bay, a lift.
  const has = (attribute: MappedFact["attribute"]) => facts.some((f) => f.attribute === attribute);
  if (tags.amenity === "bench" && !has("bench")) add("bench", bool(true));
  if (tags.parking_space === "disabled" && !has("disabled_parking")) add("disabled_parking", bool(true));
  if (tags.highway === "elevator" && !has("lift")) add("lift", bool(true));
  if (tags.amenity === "shelter" && tags.shelter_type === "public_transport" && !has("shelter")) add("shelter", bool(true));

  // The venue's own `level` says more than the building's height, and a café's building may be taller than the
  // café, so `building:levels` counts only for venues that fill their building. One fact per record either way.
  if (tags.level !== undefined) {
    const storeys = storeysFromLevel(tags.level);
    if (storeys === null || storeys > 50) skipped.push(`level=${tags.level}`);
    else add("levels", num(storeys, "count"), `level=${tags.level}`);
  } else if (tags["building:levels"] !== undefined && fillsBuilding(tags)) {
    const raw = tags["building:levels"];
    const storeys = COUNT.test(raw) ? Number(raw) : null;
    if (storeys === null || !inRange(storeys, 1, 50)) skipped.push(`building:levels=${raw}`);
    else add("levels", num(storeys, "count"), `building:levels=${raw}`);
  }

  if (category.skipWithoutFacts && facts.length === 0) return { place: null, skipped };
  if (el.entrance) facts.push(...entranceFacts(el.entrance, skipped));

  const place: MappedPlace = {
    externalRef: `osm:${el.type}/${el.id}`,
    name: tags.name ?? unnamedName ?? "",
    category: category.id,
    location: { x: lon, y: lat },
    street: tags["addr:street"] ?? null,
    houseNumber: tags["addr:housenumber"] ?? null,
    facts,
    ...(el.entrancesChecked ? { entrancesChecked: true } : {}),
  };
  return { place, skipped };
}

type RelationTag = { key: string; value: string };

/** The relation tags that name their unnamed members (`public_transport=stop_area`), from the categories' rules. */
export function namingRelations(categories: readonly CategoryConfig[] = configuredCategories): RelationTag[] {
  const tags = categories.flatMap((c) => c.osm.flatMap((r) => (r.nameFromRelation ? [r.nameFromRelation] : [])));
  return tags.filter((t, i) => tags.findIndex((o) => o.key === t.key && o.value === t.value) === i);
}

export const isNamingRelation = (tags: Record<string, string> | undefined, naming: readonly RelationTag[]) =>
  !!tags && naming.some((n) => tags[n.key] === n.value);

const METRES_PER_DEGREE = 111_320;

export function distanceM(a: OsmElement, b: OsmElement): number {
  const [latA, lonA] = [a.lat ?? a.center?.lat ?? NaN, a.lon ?? a.center?.lon ?? NaN];
  const [latB, lonB] = [b.lat ?? b.center?.lat ?? NaN, b.lon ?? b.center?.lon ?? NaN];
  const dy = (latA - latB) * METRES_PER_DEGREE;
  const dx = (lonA - lonB) * METRES_PER_DEGREE * Math.cos((((latA + latB) / 2) * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

const TYPE_ORDER = { node: 0, way: 1, relation: 2 } as const;
const nameOf = (el: OsmElement) => el.tags?.name ?? el.relationName;
const tagCount = (el: OsmElement) => Object.keys(el.tags ?? {}).length;
/** Two bays of one stop share a name but not their `ref` / `local_ref`; those are two places. */
const bayOf = (el: OsmElement) => el.tags?.ref ?? el.tags?.local_ref;

/** Named first, then the one with most tags; node before way, then the lower id, so a rerun keeps the same one. */
const keepFirst = (a: OsmElement, b: OsmElement) =>
  Number(!nameOf(a)) - Number(!nameOf(b)) ||
  tagCount(b) - tagCount(a) ||
  TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
  a.id - b.id;

/**
 * Turns fetched elements into the records to map. Unnamed members of a naming relation (`stop_area`) take its name and
 * the naming relations, which are not places, are dropped. Elements of a category with `mergeWithinM` that stand for
 * one place (closer than that, same name or one unnamed, no different `ref`) become one: the named one with the most
 * tags. Facts only the dropped twin carries are not carried over.
 */
export function prepareOsmElements(
  elements: readonly OsmElement[],
  categories: readonly CategoryConfig[] = configuredCategories,
): OsmElement[] {
  const naming = namingRelations(categories);
  // A platform is often in a stop area for the whole interchange ("Rondo Mogilskie") and in one for its own stop
  // ("Rondo Mogilskie 04"): the smallest area names it.
  const names = new Map<string, { name: string; size: number }>();
  for (const el of elements) {
    if (el.type !== "relation" || !isNamingRelation(el.tags, naming) || !el.tags?.name) continue;
    const size = el.members?.length ?? 0;
    for (const m of el.members ?? []) {
      const key = `${m.type}/${m.ref}`;
      const known = names.get(key);
      if (!known || size < known.size) names.set(key, { name: el.tags.name, size });
    }
  }
  const places = elements
    .filter((el) => !(el.type === "relation" && isNamingRelation(el.tags, naming) && !categoryOf(el.tags ?? {}, categories)))
    .map((el) => {
      const place: OsmElement = { ...el };
      delete place.members;
      const relationName = el.tags?.name ? undefined : names.get(`${el.type}/${el.id}`)?.name;
      if (relationName) place.relationName = relationName;
      return place;
    });

  const dropped = new Set<OsmElement>();
  for (const category of categories) {
    if (!category.mergeWithinM) continue;
    const within = category.mergeWithinM;
    const candidates = places.filter((el) => categoryOf(el.tags ?? {}, categories)?.category === category).sort(keepFirst);
    const kept: OsmElement[] = [];
    for (const el of candidates) {
      const same = kept.find((k) => {
        const [a, b] = [nameOf(el), nameOf(k)];
        const [refA, refB] = [bayOf(el), bayOf(k)];
        return (!a || !b || a === b) && !(refA && refB && refA !== refB) && distanceM(el, k) <= within;
      });
      if (same) dropped.add(el);
      else kept.push(el);
    }
  }
  return places.filter((el) => !dropped.has(el));
}

