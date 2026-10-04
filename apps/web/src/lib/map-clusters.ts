import Supercluster from "supercluster";
import type { PlacePoint } from "@krakow-bez-barier/contracts";
import type { Status } from "@krakow-bez-barier/ui";
import { STATUS_ORDER } from "./profile/verdict-list";

/**
 * Screen pixels within which pins merge into a cluster, at the cluster's level: a pin's width plus a little. Levels
 * switch halfway (`clusterZoom`), so just after a split pins may overlap by a few px, like Apple Maps' do.
 */
export const CLUSTER_RADIUS = 40;
/** Above this zoom (street level) every place shows as its own pin; places at the same spot are spread in a ring. */
export const CLUSTER_MAX_ZOOM = 16;
const SPREAD_RADIUS = 26;

export type VerdictCounts = Record<Status | "none", number>;

type PointProps = { id: string; category: PlacePoint["category"]; status: Status | null };

/** Places as GeoJSON points (`[lon, lat]`, altitude dropped) carrying what a pin needs: id, category, verdict. */
export function placeFeatures(places: PlacePoint[]) {
  return places.map((place) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: place.location.coordinates.slice(0, 2) },
    properties: { id: place.id, category: place.category, status: place.verdict } satisfies PointProps,
  }));
}
type ClusterProps = VerdictCounts;

export type MapItem =
  | {
      kind: "cluster";
      key: string;
      clusterId: number;
      count: number;
      counts: VerdictCounts;
      coordinates: [number, number];
    }
  | { kind: "place"; key: string; place: PlacePoint; coordinates: [number, number]; offset: [number, number] };

export type ClusterIndex = { index: Supercluster<PointProps, ClusterProps>; byId: Map<string, PlacePoint> };

const emptyCounts = (): VerdictCounts => ({ met: 0, barrier: 0, conflict: 0, unknown: 0, none: 0 });

export function buildClusterIndex(places: PlacePoint[]): ClusterIndex {
  const index = new Supercluster<PointProps, ClusterProps>({
    radius: CLUSTER_RADIUS,
    maxZoom: CLUSTER_MAX_ZOOM,
    map: ({ status }) => ({ ...emptyCounts(), [status ?? "none"]: 1 }),
    reduce: (acc, props) => {
      for (const key of Object.keys(emptyCounts()) as (keyof VerdictCounts)[]) acc[key] += props[key];
    },
  });
  index.load(placeFeatures(places));
  return { index, byId: new Map(places.map((place) => [place.id, place])) };
}

/** Number of places inside a viewport (`bbox` = west, south, east, north), clustered or not. */
export function placesInView({ byId }: ClusterIndex, [west, south, east, north]: [number, number, number, number]): number {
  let n = 0;
  for (const place of byId.values()) {
    const [lon, lat] = place.location.coordinates;
    if (lon >= west && lon <= east && lat >= south && lat <= north) n++;
  }
  return n;
}

/** Pixel offsets that fan `n` pins out in a ring around their shared spot (none for a single pin). */
export function spreadOffsets(n: number): [number, number][] {
  if (n < 2) return [[0, 0]];
  const radius = Math.max(SPREAD_RADIUS, (n * 40) / (2 * Math.PI));
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius)];
  });
}

/**
 * The clustering level for a camera zoom: the nearest whole level, so a cluster splits halfway to the zoom
 * where its places would stop overlapping instead of only once the camera gets there.
 */
export function clusterZoom(zoom: number): number {
  return Math.round(zoom);
}

/** Clusters and single places to draw for a viewport (`bbox` = west, south, east, north). */
export function mapItems({ index, byId }: ClusterIndex, bbox: [number, number, number, number], zoom: number): MapItem[] {
  const items: MapItem[] = [];
  const spots = new Map<string, Extract<MapItem, { kind: "place" }>[]>();
  for (const feature of index.getClusters(bbox, clusterZoom(zoom))) {
    const coordinates = feature.geometry.coordinates as [number, number];
    const props = feature.properties;
    if ("cluster" in props && props.cluster) {
      const { cluster_id, point_count, met, barrier, conflict, unknown, none } = props;
      items.push({
        kind: "cluster",
        // What it shows, not the cluster's id: ids are per index, and new points rebuild it. A marker is kept while its
        // key stays, so a new breakdown (a profile switched on) gets a new one.
        key: `c:${coordinates.map((n) => n.toFixed(6)).join(",")}:${point_count}:${met},${barrier},${conflict},${unknown}`,
        clusterId: cluster_id,
        count: point_count,
        counts: { met, barrier, conflict, unknown, none },
        coordinates,
      });
      continue;
    }
    const place = byId.get((props as PointProps).id);
    if (!place) continue;
    const key = `p:${place.id}:${place.category}:${place.verdict ?? "none"}`;
    const item = { kind: "place" as const, key, place, coordinates, offset: [0, 0] as [number, number] };
    const spot = coordinates.join(",");
    spots.set(spot, [...(spots.get(spot) ?? []), item]);
    items.push(item);
  }
  for (const group of spots.values()) {
    const offsets = spreadOffsets(group.length);
    group.forEach((item, i) => (item.offset = offsets[i]));
  }
  return items;
}

/** Zoom at which a cluster splits into smaller clusters or pins. */
export function expansionZoom({ index }: ClusterIndex, clusterId: number): number {
  return index.getClusterExpansionZoom(clusterId);
}

/** Ids of every place inside a cluster. */
export function clusterPlaceIds({ index }: ClusterIndex, clusterId: number): string[] {
  return index.getLeaves(clusterId, Infinity).map((leaf) => leaf.properties.id);
}

/**
 * Donut segments as fractions of the whole cluster (`start`, `length` in 0..1). The denominator is
 * `count`, not the sum of verdicts: places without a verdict leave their share of the ring unpainted,
 * so missing data never reads as accessible.
 */
export function donutSegments(breakdown: [Status, number][], count: number): { status: Status; start: number; length: number }[] {
  if (count <= 0) return [];
  let start = 0;
  return breakdown.map(([status, n]) => {
    const segment = { status, start, length: n / count };
    start += segment.length;
    return segment;
  });
}

/** Verdict counts as `[status, count]` pairs in the legend's order, skipping zeros; empty without a profile. */
export function verdictBreakdown(counts: VerdictCounts): [Status, number][] {
  return STATUS_ORDER.filter((status) => counts[status] > 0).map((status) => [status, counts[status]]);
}

/** A marker on the map as the transitions see it: where it is drawn (screen px) and how many places it holds. */
export type MarkerSpot = { key: string; at: { x: number; y: number }; count: number };

/** How far (px) a cluster's children land from it when it splits: they were within its radius one level up. */
export const SPLIT_REACH = CLUSTER_RADIUS * 3;

export type MarkerMoves = {
  /** Entering markers that fly out of a bigger marker leaving at the same time (zoom in): where they start. */
  from: Map<string, { x: number; y: number }>;
  /** Leaving markers that fly into a bigger marker entering at the same time (zoom out): where they end. */
  to: Map<string, { x: number; y: number }>;
};

/** The nearest spot holding more places than `spot`, within `SPLIT_REACH`. */
function parentOf(spot: MarkerSpot, candidates: readonly MarkerSpot[]) {
  let best: MarkerSpot | undefined;
  let bestDistance = SPLIT_REACH;
  for (const candidate of candidates) {
    if (candidate.count <= spot.count) continue;
    const distance = Math.hypot(candidate.at.x - spot.at.x, candidate.at.y - spot.at.y);
    if (distance <= bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Pairs markers leaving the map with those entering it, as Apple and Google Maps animate clusters: on zoom in, a
 * cluster's children fly out of it; on zoom out, they fly into the cluster that merges them. A child's partner is the
 * nearest bigger marker within reach: geometry, not membership, so no cluster's leaves are listed on every zoom step.
 * Only the marker standing for fewer places moves; the bigger one fades in or out in place, and a pan's markers,
 * which have no bigger partner nearby, just fade.
 */
export function markerMoves(leaving: readonly MarkerSpot[], entering: readonly MarkerSpot[]): MarkerMoves {
  const moves: MarkerMoves = { from: new Map(), to: new Map() };
  for (const spot of entering) {
    const parent = parentOf(spot, leaving);
    if (parent) moves.from.set(spot.key, parent.at);
  }
  for (const spot of leaving) {
    const parent = parentOf(spot, entering);
    if (parent) moves.to.set(spot.key, parent.at);
  }
  return moves;
}
