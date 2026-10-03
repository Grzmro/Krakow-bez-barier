import Supercluster from "supercluster";
import type { PlaceSummary } from "@krakow-bez-barier/contracts";
import type { Status } from "@krakow-bez-barier/ui";
import { STATUS_ORDER } from "./profile/verdict-list";

/** Screen pixels within which pins merge into a cluster (at the cluster's whole zoom level). */
export const CLUSTER_RADIUS = 44;
/** Above this zoom every place shows as its own pin; places at the same spot are spread in a ring. */
export const CLUSTER_MAX_ZOOM = 18;
const SPREAD_RADIUS = 26;

export type VerdictCounts = Record<Status | "none", number>;

type PointProps = { id: string; status: Status | null };
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
  | { kind: "place"; key: string; place: PlaceSummary; coordinates: [number, number]; offset: [number, number] };

export type ClusterIndex = { index: Supercluster<PointProps, ClusterProps>; byId: Map<string, PlaceSummary> };

const emptyCounts = (): VerdictCounts => ({ met: 0, barrier: 0, conflict: 0, unknown: 0, none: 0 });

export function buildClusterIndex(places: PlaceSummary[]): ClusterIndex {
  const index = new Supercluster<PointProps, ClusterProps>({
    radius: CLUSTER_RADIUS,
    maxZoom: CLUSTER_MAX_ZOOM,
    map: ({ status }) => ({ ...emptyCounts(), [status ?? "none"]: 1 }),
    reduce: (acc, props) => {
      for (const key of Object.keys(emptyCounts()) as (keyof VerdictCounts)[]) acc[key] += props[key];
    },
  });
  index.load(
    places.map((place) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: place.location.coordinates.slice(0, 2) },
      properties: { id: place.id, status: place.verdict?.state ?? null },
    })),
  );
  return { index, byId: new Map(places.map((place) => [place.id, place])) };
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

/** Clusters and single places to draw for a viewport (`bbox` = west, south, east, north). */
export function mapItems({ index, byId }: ClusterIndex, bbox: [number, number, number, number], zoom: number): MapItem[] {
  const items: MapItem[] = [];
  const spots = new Map<string, Extract<MapItem, { kind: "place" }>[]>();
  for (const feature of index.getClusters(bbox, zoom)) {
    const coordinates = feature.geometry.coordinates as [number, number];
    const props = feature.properties;
    if ("cluster" in props && props.cluster) {
      const { cluster_id, point_count, met, barrier, conflict, unknown, none } = props;
      items.push({
        kind: "cluster",
        key: `c:${cluster_id}:${point_count}`,
        clusterId: cluster_id,
        count: point_count,
        counts: { met, barrier, conflict, unknown, none },
        coordinates,
      });
      continue;
    }
    const place = byId.get((props as PointProps).id);
    if (!place) continue;
    const item = { kind: "place" as const, key: `p:${place.id}`, place, coordinates, offset: [0, 0] as [number, number] };
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
