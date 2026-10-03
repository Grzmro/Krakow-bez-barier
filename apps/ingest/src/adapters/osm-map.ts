import {
  categories as configuredCategories,
  type CategoryConfig,
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
};

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
  const unnamedName = rule.unnamedName ?? category.unnamedName;
  if (!tags.name && !unnamedName) return { place: null, skipped: ["unnamed place"] };

  const ref = recordRef(el);
  const observedAt = parseDate(tags.check_date);
  const facts: MappedFact[] = [];
  const add = (attribute: MappedFact["attribute"], value: FactValue, comment?: string) =>
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

  if (tags.wheelchair !== undefined) {
    if (["yes", "limited", "no"].includes(tags.wheelchair)) {
      add("wheelchair_overall", { kind: "text", text: tags.wheelchair }, tags["wheelchair:description"]);
    } else skipped.push(`wheelchair=${tags.wheelchair}`);
  }
  triState("toilets:wheelchair", "toilet_accessible");
  triState("changing_table", "changing_table");
  triState("bench", "bench");
  triState("elevator", "lift");
  triState("ramp:wheelchair", "ramp");
  // A bare `ramp=yes` may be a rail for bikes or prams only, so it says nothing about a wheelchair ramp; `ramp=no` does.
  if (tags["ramp:wheelchair"] === undefined && tags.ramp !== undefined) {
    if (tags.ramp === "no") add("ramp", bool(false));
    else skipped.push(`ramp=${tags.ramp}`);
  }

  if (tags.step_count !== undefined) {
    if (COUNT.test(tags.step_count)) add("step_count", num(Number(tags.step_count), "count"));
    else skipped.push(`step_count=${tags.step_count}`);
  }

  for (const tag of ["door:width", "entrance:width"]) {
    if (tags[tag] === undefined) continue;
    const cm = parseCentimetres(tags[tag]);
    if (cm === null || !inRange(cm, 30, 300)) skipped.push(`${tag}=${tags[tag]}`);
    else if (!facts.some((f) => f.attribute === "door_width_cm")) add("door_width_cm", num(cm, "cm"));
  }

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

  const place: MappedPlace = {
    externalRef: `osm:${el.type}/${el.id}`,
    name: tags.name ?? unnamedName ?? "",
    category: category.id,
    location: { x: lon, y: lat },
    street: tags["addr:street"] ?? null,
    houseNumber: tags["addr:housenumber"] ?? null,
    facts,
  };
  return { place, skipped };
}
