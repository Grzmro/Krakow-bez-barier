import { categories as configuredCategories, type CategoryConfig } from "@krakow-bez-barier/contracts";
import type { FetchContext } from "../adapter";
import { categoryOf, distanceM, ENTRANCE_KINDS, ENTRANCE_TAGS, type OsmElement } from "./osm-map";

/** A way or multipolygon an entrance node lies on: a building outline or the outline of a place itself. */
export type OsmOutline = {
  type: "way" | "relation";
  id: number;
  tags: Record<string, string>;
  /** Node ids on the outline (of a relation: of its member ways that were read). */
  nodes: number[];
  /** The outline's lines as `[lon, lat]` points; rings are closed (first point = last). */
  lines: [number, number][][];
};

export type OsmEntrances = { entrances: OsmElement[]; outlines: OsmOutline[] };

/** An entrance node this close to exactly one place, and on no outline that decides, belongs to that place. */
export const ENTRANCE_RADIUS_M = 5;

export type EntranceStats = {
  entrances: number;
  /** `entrance=exit`, `staircase`, `garage`, …: not a way into a place we list. */
  otherKind: number;
  /** The entrance node is a place itself; its own tags already give its facts. */
  isPlace: number;
  onOutline: number;
  inBuilding: number;
  nearby: number;
  /** Two or more places could own the entrance: no fact. */
  ambiguous: number;
  unmatched: number;
  placesWithEntrance: number;
  /** Places with several entrances and no single main one: no entrance fact. */
  placesAmbiguous: number;
};

/** Overpass QL for the entrance nodes with an accessibility tag, the ways they lie on and those ways' multipolygons. */
export function buildEntranceQuery(bbox: FetchContext["city"]["bbox"]): string {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const tagged = ENTRANCE_TAGS.map((t) => `  node.all["${t}"];`).join("\n");
  return [
    "[out:json][timeout:120];",
    `node["entrance"](${box})->.all;`,
    `(\n${tagged}\n)->.e;`,
    ".e out meta;",
    "way(bn.e)->.w;",
    ".w out body geom;",
    'rel(bw.w)["type"="multipolygon"]->.r;',
    ".r out body geom;",
  ].join("\n");
}

type LatLon = { lat: number; lon: number };
type OverpassWay = { type: "way"; id: number; nodes?: number[]; geometry?: (LatLon | null)[]; tags?: Record<string, string> };
type OverpassRelation = {
  type: "relation";
  id: number;
  members?: { type: string; ref: number; role?: string; geometry?: (LatLon | null)[] }[];
  tags?: Record<string, string>;
};
export type OverpassEntranceElement = OsmElement | OverpassWay | OverpassRelation;

const toLine = (geometry: (LatLon | null)[] | undefined): [number, number][] =>
  (geometry ?? []).filter((p): p is LatLon => !!p).map((p) => [p.lon, p.lat]);

/** The answer to `buildEntranceQuery` as entrances and outlines. */
export function entrancesFromOverpass(elements: readonly OverpassEntranceElement[]): OsmEntrances {
  const entrances: OsmElement[] = [];
  const ways = new Map<number, OverpassWay>();
  const relations: OverpassRelation[] = [];
  for (const el of elements) {
    if (el.type === "node") {
      if ((el as OsmElement).tags?.entrance !== undefined) entrances.push(el as OsmElement);
    } else if (el.type === "way") ways.set(el.id, el as OverpassWay);
    else relations.push(el as OverpassRelation);
  }
  const outlines: OsmOutline[] = [...ways.values()].map((w) => ({
    type: "way",
    id: w.id,
    tags: w.tags ?? {},
    nodes: w.nodes ?? [],
    lines: [toLine(w.geometry)],
  }));
  for (const r of relations) {
    const members = (r.members ?? []).filter((m) => m.type === "way");
    outlines.push({
      type: "relation",
      id: r.id,
      tags: r.tags ?? {},
      nodes: members.flatMap((m) => ways.get(m.ref)?.nodes ?? []),
      lines: members.map((m) => toLine(m.geometry)).filter((l) => l.length > 1),
    });
  }
  return { entrances, outlines };
}

/** Even-odd ray casting over all the outline's lines, so holes (inner rings) count as outside. */
export function insideOutline(outline: OsmOutline, lon: number, lat: number): boolean {
  let inside = false;
  for (const line of outline.lines) {
    for (let i = 1; i < line.length; i++) {
      const [xi, yi] = line[i];
      const [xj, yj] = line[i - 1];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const isBuilding = (o: OsmOutline) => o.tags.building !== undefined && o.tags.building !== "no";
const keyOf = (el: { type: string; id: number }) => `${el.type}/${el.id}`;

/** Venues with doors: not hidden bulk data, bits of the way, or categories marked `withoutEntrances`. */
function takesEntrances(el: OsmElement, categories: readonly CategoryConfig[]): boolean {
  const category = categoryOf(el.tags ?? {}, categories)?.category;
  return !!category && !category.hiddenByDefault && !category.onRoutes && !category.withoutEntrances;
}

const unique = <T>(items: T[]) => [...new Set(items)];

type Owner = { place: OsmElement; how: "onOutline" | "inBuilding" | "nearby" } | "ambiguous" | null;

/**
 * Attaches to each place the entrance node whose facts it takes. An entrance belongs to a place when it lies on the
 * place's own outline, else when it lies on a building with exactly one place node inside, else when exactly one place
 * is within `radiusM`; anything less certain gives no owner. A place with several entrances takes its single main one,
 * or its only one; otherwise none, so two entrances of one place never stand as a conflict.
 * Every returned place is marked `entrancesChecked`.
 */
export function attachEntrances(
  places: readonly OsmElement[],
  data: OsmEntrances,
  categories: readonly CategoryConfig[] = configuredCategories,
  radiusM = ENTRANCE_RADIUS_M,
): { places: OsmElement[]; stats: EntranceStats } {
  const stats: EntranceStats = {
    entrances: data.entrances.length,
    otherKind: 0,
    isPlace: 0,
    onOutline: 0,
    inBuilding: 0,
    nearby: 0,
    ambiguous: 0,
    unmatched: 0,
    placesWithEntrance: 0,
    placesAmbiguous: 0,
  };
  const all = new Set(places.map(keyOf));
  const eligible = places.filter((p) => takesEntrances(p, categories));
  const byKey = new Map(eligible.map((p) => [keyOf(p), p]));
  const nodes = eligible.filter((p) => p.type === "node" && p.lat !== undefined && p.lon !== undefined);
  const outlinesByNode = new Map<number, OsmOutline[]>();
  for (const outline of data.outlines) {
    for (const node of new Set(outline.nodes)) outlinesByNode.set(node, [...(outlinesByNode.get(node) ?? []), outline]);
  }

  const ownerOf = (entrance: OsmElement): Owner => {
    const outlines = outlinesByNode.get(entrance.id) ?? [];
    const buildings = outlines.filter(isBuilding);
    // A square or a park sharing its edge with a house front doesn't own the house's door.
    const deciding = buildings.length > 0 ? buildings : outlines;
    const own = unique(deciding.map((o) => byKey.get(keyOf(o))).filter((p): p is OsmElement => !!p));
    if (own.length > 1) return "ambiguous";
    if (own.length === 1) return { place: own[0], how: "onOutline" };
    const inside = nodes.filter((p) => buildings.some((b) => insideOutline(b, p.lon!, p.lat!)));
    if (inside.length > 1) return "ambiguous";
    if (inside.length === 1) return { place: inside[0], how: "inBuilding" };
    const near = eligible.filter((p) => distanceM(entrance, p) <= radiusM);
    if (near.length > 1) return "ambiguous";
    return near.length === 1 ? { place: near[0], how: "nearby" } : null;
  };

  const byPlace = new Map<OsmElement, OsmElement[]>();
  for (const entrance of data.entrances) {
    if (!ENTRANCE_KINDS[entrance.tags?.entrance ?? ""]) {
      stats.otherKind += 1;
      continue;
    }
    if (all.has(keyOf(entrance))) {
      stats.isPlace += 1;
      continue;
    }
    const owner = ownerOf(entrance);
    if (owner === "ambiguous") stats.ambiguous += 1;
    else if (owner === null) stats.unmatched += 1;
    else {
      stats[owner.how] += 1;
      byPlace.set(owner.place, [...(byPlace.get(owner.place) ?? []), entrance]);
    }
  }

  const chosen = new Map<OsmElement, OsmElement>();
  for (const [place, entrances] of byPlace) {
    const main = entrances.filter((e) => e.tags?.entrance === "main");
    const pick = main.length === 1 ? main[0] : main.length === 0 && entrances.length === 1 ? entrances[0] : null;
    if (pick) chosen.set(place, pick);
    else stats.placesAmbiguous += 1;
  }
  stats.placesWithEntrance = chosen.size;

  return {
    places: places.map((p) => {
      const entrance = chosen.get(p);
      return { ...p, entrancesChecked: true, ...(entrance ? { entrance } : {}) };
    }),
    stats,
  };
}

export const describeEntranceStats = (s: EntranceStats) =>
  `entrances: ${s.entrances} read, ${s.onOutline} on a place's outline, ${s.inBuilding} in its building, ` +
  `${s.nearby} within ${ENTRANCE_RADIUS_M} m, ${s.ambiguous} ambiguous, ${s.unmatched} unmatched, ` +
  `${s.otherKind} other kinds, ${s.isPlace} are places; ${s.placesWithEntrance} places take one, ` +
  `${s.placesAmbiguous} have several without one main`;
