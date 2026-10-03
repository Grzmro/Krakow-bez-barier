import { describe, expect, it } from "vitest";
import type { PlaceSummary } from "@krakow-bez-barier/contracts";
import type { Status } from "@krakow-bez-barier/ui";
import { buildClusterIndex, CLUSTER_MAX_ZOOM, expansionZoom, mapItems, spreadOffsets, verdictBreakdown } from "./map-clusters";

const KRAKOW: [number, number, number, number] = [19.7, 49.9, 20.2, 50.2];

function place(id: string, lon: number, lat: number, status?: Status): PlaceSummary {
  return {
    id,
    location: { type: "Point", coordinates: [lon, lat] },
    ...(status ? { verdict: { state: status } } : {}),
  } as PlaceSummary;
}

describe("map clusters", () => {
  it("merges nearby places into one cluster when zoomed out and splits it when zoomed in", () => {
    // GIVEN three places a few dozen metres apart around the Main Square and one in Nowa Huta
    const index = buildClusterIndex([
      place("a", 19.9373, 50.0617),
      place("b", 19.9378, 50.0619),
      place("c", 19.9369, 50.0613),
      place("d", 20.0347, 50.0717),
    ]);

    // WHEN the whole city is in view
    const far = mapItems(index, KRAKOW, 11);

    // THEN the square is one cluster of three and Nowa Huta is a single pin
    expect(far.map((item) => (item.kind === "cluster" ? item.count : item.place.id)).sort()).toEqual([3, "d"].sort());

    // WHEN the map zooms in to street level
    const near = mapItems(index, KRAKOW, CLUSTER_MAX_ZOOM + 1);

    // THEN every place has its own pin, so nothing is hidden
    expect(near.filter((item) => item.kind === "place")).toHaveLength(4);
  });

  it("counts the verdicts inside a cluster for the donut, in the legend's order", () => {
    // GIVEN places with a profile verdict on each, one without
    const index = buildClusterIndex([
      place("a", 19.9373, 50.0617, "met"),
      place("b", 19.9374, 50.0617, "met"),
      place("c", 19.9375, 50.0618, "barrier"),
      place("d", 19.9376, 50.0618, "unknown"),
      place("e", 19.9377, 50.0619),
    ]);

    // WHEN they cluster
    const [cluster] = mapItems(index, KRAKOW, 12);

    // THEN the counts add up and the breakdown skips empty statuses
    expect(cluster).toMatchObject({ kind: "cluster", count: 5, counts: { met: 2, barrier: 1, unknown: 1, conflict: 0, none: 1 } });
    if (cluster.kind !== "cluster") throw new Error("expected a cluster");
    expect(verdictBreakdown(cluster.counts)).toEqual([
      ["met", 2],
      ["unknown", 1],
      ["barrier", 1],
    ]);
  });

  it("gives a zoom that splits the cluster", () => {
    // GIVEN two places 300 m apart, clustered at city zoom
    const index = buildClusterIndex([place("a", 19.93, 50.06), place("b", 19.934, 50.06)]);
    const [cluster] = mapItems(index, KRAKOW, 11);
    if (cluster.kind !== "cluster") throw new Error("expected a cluster");

    // WHEN the visitor taps it
    const zoom = expansionZoom(index, cluster.clusterId);

    // THEN at that zoom both places show as pins
    expect(mapItems(index, KRAKOW, zoom).map((item) => item.kind)).toEqual(["place", "place"]);
  });

  it("fans out places that share one spot past the last cluster zoom", () => {
    // GIVEN three places at exactly the same coordinates (one building)
    const index = buildClusterIndex([place("a", 19.9373, 50.0617), place("b", 19.9373, 50.0617), place("c", 19.9373, 50.0617)]);

    // WHEN the map is past the last cluster zoom
    const items = mapItems(index, KRAKOW, CLUSTER_MAX_ZOOM + 1);

    // THEN each pin has its own offset, so each can be tapped
    const offsets = items.map((item) => (item.kind === "place" ? item.offset.join(",") : ""));
    expect(new Set(offsets).size).toBe(3);
  });

  it("keeps the whole city to a few dozen markers with ~1000 places", () => {
    // GIVEN 960 places spread over central Kraków (a deterministic grid)
    const places = Array.from({ length: 960 }, (_, i) => place(`p${i}`, 19.88 + (i % 40) * 0.003, 50.03 + Math.floor(i / 40) * 0.002));
    const index = buildClusterIndex(places);

    // WHEN the map shows the whole area on a phone (~350 px wide at zoom 11)
    const items = mapItems(index, KRAKOW, 11);

    // THEN there are few markers and every place is counted in one of them
    expect(items.length).toBeLessThan(60);
    expect(items.reduce((sum, item) => sum + (item.kind === "cluster" ? item.count : 1), 0)).toBe(960);
  });

  it("leaves a lone pin in place and spreads a group at least a pin apart", () => {
    // GIVEN / WHEN / THEN
    expect(spreadOffsets(1)).toEqual([[0, 0]]);
    const ring = spreadOffsets(12);
    const gap = Math.hypot(ring[0][0] - ring[1][0], ring[0][1] - ring[1][1]);
    expect(gap).toBeGreaterThanOrEqual(36);
  });
});
