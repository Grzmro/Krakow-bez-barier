import { describe, expect, it } from "vitest";
import type { PlacePoint } from "@krakow-bez-barier/contracts";
import type { Status } from "@krakow-bez-barier/ui";
import {
  buildClusterIndex,
  CLUSTER_MAX_ZOOM,
  clusterPlaceIds,
  donutSegments,
  expansionZoom,
  mapItems,
  markerMoves,
  placeFeatures,
  SPLIT_REACH,
  placesInView,
  spreadOffsets,
  verdictBreakdown,
} from "./map-clusters";

const KRAKOW: [number, number, number, number] = [19.7, 49.9, 20.2, 50.2];

function place(id: string, lon: number, lat: number, status?: Status): PlacePoint {
  return { id, name: id, category: "museum", location: { type: "Point", coordinates: [lon, lat] }, verdict: status ?? null };
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

  it("keeps markers bounded at every zoom with several thousand places", () => {
    // GIVEN 5000 places over the whole city (a deterministic grid)
    const places = Array.from({ length: 5000 }, (_, i) => place(`p${i}`, 19.8 + (i % 100) * 0.0035, 49.98 + Math.floor(i / 100) * 0.003));
    const index = buildClusterIndex(places);

    // WHEN the whole city is in view, and later one street-level viewport (~400 × 800 px at zoom 17)
    const city = mapItems(index, KRAKOW, 11);
    const street = mapItems(index, [19.93, 50.05, 19.934, 50.054], 17);

    // THEN the city (~730 px wide at zoom 11) draws about one marker per cluster radius, a street a few
    // dozen, never thousands, and the city view counts every place
    expect(city.length).toBeLessThan(400);
    expect(street.length).toBeLessThan(80);
    expect(city.reduce((sum, item) => sum + (item.kind === "cluster" ? item.count : 1), 0)).toBe(5000);
  });

  it("turns places into GeoJSON points with what a pin needs", () => {
    // GIVEN a museum with a 3D location and a verdict, and a toilet without one
    const museum: PlacePoint = { ...place("m", 19.9373, 50.0617, "barrier"), location: { type: "Point", coordinates: [19.9373, 50.0617, 210] } };
    const toilet: PlacePoint = { ...place("t", 19.94, 50.06), category: "toilet" };

    // WHEN they become features
    const features = placeFeatures([museum, toilet]);

    // THEN each is a 2D point with its id, category and verdict (null when there is no profile)
    expect(features).toEqual([
      { type: "Feature", geometry: { type: "Point", coordinates: [19.9373, 50.0617] }, properties: { id: "m", category: "museum", status: "barrier" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [19.94, 50.06] }, properties: { id: "t", category: "toilet", status: null } },
    ]);
  });

  it("counts the places inside the viewport, clustered or not", () => {
    // GIVEN three places on the Main Square and one in Nowa Huta
    const index = buildClusterIndex([
      place("a", 19.9373, 50.0617),
      place("b", 19.9378, 50.0619),
      place("c", 19.9369, 50.0613),
      place("d", 20.0347, 50.0717),
    ]);

    // WHEN / THEN the old town alone holds three, the whole city four
    expect(placesInView(index, [19.92, 50.05, 19.95, 50.07])).toBe(3);
    expect(placesInView(index, KRAKOW)).toBe(4);
  });

  it("leaves a lone pin in place and spreads a group at least a pin apart", () => {
    // GIVEN / WHEN / THEN
    expect(spreadOffsets(1)).toEqual([[0, 0]]);
    const ring = spreadOffsets(12);
    const gap = Math.hypot(ring[0][0] - ring[1][0], ring[0][1] - ring[1][1]);
    expect(gap).toBeGreaterThanOrEqual(36);
  });

  it("never paints the share of places without a verdict in the donut", () => {
    // GIVEN a cluster of 5 places where only one has a verdict (met)
    const breakdown: [Status, number][] = [["met", 1]];

    // WHEN the donut is drawn
    const segments = donutSegments(breakdown, 5);

    // THEN green covers a fifth of the ring and the rest stays unpainted
    expect(segments).toEqual([{ status: "met", start: 0, length: 0.2 }]);
  });

  it("lays donut segments end to end in the breakdown's order", () => {
    // GIVEN / WHEN a fully judged cluster of 4
    const segments = donutSegments([["met", 1], ["unknown", 1], ["barrier", 2]], 4);

    // THEN the segments are contiguous and fill the ring
    expect(segments).toEqual([
      { status: "met", start: 0, length: 0.25 },
      { status: "unknown", start: 0.25, length: 0.25 },
      { status: "barrier", start: 0.5, length: 0.5 },
    ]);
  });

  it("lists the places inside a cluster, so a highlighted list row can mark it", () => {
    // GIVEN three places on the Main Square and one in Nowa Huta
    const index = buildClusterIndex([
      place("a", 19.9373, 50.0617),
      place("b", 19.9378, 50.0619),
      place("c", 19.9369, 50.0613),
      place("d", 20.0347, 50.0717),
    ]);

    // WHEN the city is in view and the square is one cluster
    const cluster = mapItems(index, KRAKOW, 11).find((item) => item.kind === "cluster");
    if (cluster?.kind !== "cluster") throw new Error("expected a cluster");

    // THEN it holds exactly the square's places
    expect(clusterPlaceIds(index, cluster.clusterId).toSorted()).toEqual(["a", "b", "c"]);
  });

  it("shows places a street apart as their own pins at street level", () => {
    // GIVEN two places on one street, about 60 m apart
    const index = buildClusterIndex([place("a", 19.9373, 50.0617), place("b", 19.9381, 50.0617)]);

    // WHEN the map is at street level (z16), or a bit before it
    const street = mapItems(index, KRAKOW, 16);
    const almost = mapItems(index, KRAKOW, 15.6);

    // THEN each is its own pin: the split no longer waits for the highest zooms
    expect(street.map((item) => item.kind)).toEqual(["place", "place"]);
    expect(almost.map((item) => item.kind)).toEqual(["place", "place"]);
  });

  it("keys a cluster by where it is and what it holds, so new points for the same view keep its marker", () => {
    // GIVEN the same three places on the square, indexed twice with another place loaded in between
    const square = [place("a", 19.9373, 50.0617), place("b", 19.9378, 50.0619), place("c", 19.9369, 50.0613)];
    const first = buildClusterIndex(square);
    const second = buildClusterIndex([place("z", 19.95, 50.08), ...square]);

    // WHEN both are drawn for the city
    const key = (index: ReturnType<typeof buildClusterIndex>) =>
      mapItems(index, KRAKOW, 11).find((item) => item.kind === "cluster" && item.count === 3)?.key;

    // THEN the square's cluster has one key in both
    expect(key(first)).toBeDefined();
    expect(key(second)).toBe(key(first));
  });

  it("flies a cluster's places out of it on zoom in and back into it on zoom out", () => {
    // GIVEN a cluster of three places and the pins it splits into, a few dozen px around it
    const cluster = { key: "c", at: { x: 200, y: 300 }, count: 3 };
    const pins = [
      { key: "p:a", at: { x: 160, y: 290 }, count: 1 },
      { key: "p:b", at: { x: 230, y: 270 }, count: 1 },
      { key: "p:c", at: { x: 205, y: 350 }, count: 1 },
    ];

    // WHEN the map zooms in: the cluster leaves, the pins enter
    const zoomIn = markerMoves([cluster], pins);

    // THEN every pin starts at the cluster, and the cluster fades out in place
    expect([...zoomIn.from.entries()]).toEqual(pins.map((pin) => [pin.key, cluster.at]));
    expect(zoomIn.to.size).toBe(0);

    // WHEN the map zooms back out: the pins leave, the cluster enters
    const zoomOut = markerMoves(pins, [cluster]);

    // THEN every pin ends at the cluster, and the cluster fades in in place
    expect([...zoomOut.to.entries()]).toEqual(pins.map((pin) => [pin.key, cluster.at]));
    expect(zoomOut.from.size).toBe(0);
  });

  it("leaves markers without a bigger partner nearby in place, as on a pan", () => {
    // GIVEN a pin leaving one side of the view, another entering the other, and a cluster far beyond reach
    const west = { key: "p:a", at: { x: -20, y: 300 }, count: 1 };
    const east = { key: "p:b", at: { x: 410, y: 300 }, count: 1 };
    const far = { key: "c", at: { x: 410, y: 300 + SPLIT_REACH + 1 }, count: 5 };

    // WHEN the transitions are paired
    const moves = markerMoves([west], [east, far]);

    // THEN nothing flies anywhere
    expect(moves.from.size).toBe(0);
    expect(moves.to.size).toBe(0);
  });

  it("flies each child out of the nearest bigger cluster, not out of a neighbour", () => {
    // GIVEN two clusters splitting at once, a sub-cluster and a pin near each
    const left = { key: "c4", at: { x: 100, y: 300 }, count: 4 };
    const right = { key: "c6", at: { x: 260, y: 300 }, count: 6 };
    const child = { key: "c3", at: { x: 90, y: 280 }, count: 3 };
    const pin = { key: "p:a", at: { x: 270, y: 330 }, count: 1 };

    // WHEN both parents leave and the children enter
    const moves = markerMoves([left, right], [child, pin]);

    // THEN each child starts at its own parent
    expect(moves.from.get("c3")).toEqual(left.at);
    expect(moves.from.get("p:a")).toEqual(right.at);
  });
});
