import { describe, expect, it } from "vitest";
import { createApiClient, createMockFetch, type PlaceSummary } from "@krakow-bez-barier/contracts";
import { withPlacesMocks } from "./mocks/mock-fetch";
import { EVENT_STOP_RADIUS_M, eventSections, formatEventDate, nearbyStops, nearbyStopsQuery } from "./event-page";

const api = createApiClient({ baseUrl: "http://localhost/api/v1", fetch: withPlacesMocks(createMockFetch()) });

async function examplePlace(id: string) {
  const { data } = await api.GET("/places/{id}", { params: { path: { id } } });
  if (!data) throw new Error(`no example place ${id}`);
  return data;
}

describe("formatEventDate", () => {
  it("formats the day in Polish without a time zone shift", () => {
    // GIVEN a date picked by the organizer
    // WHEN it's formatted
    // THEN the formatted day is the one picked
    expect(formatEventDate("2026-10-10", "pl")).toBe("sobota, 10 października 2026");
  });
});

describe("eventSections", () => {
  it("groups the entrance, toilet and parking facts and names missing data as missing", async () => {
    // GIVEN the demo hotel from the spec examples (no data on the changing table or parking)
    const place = await examplePlace("hotel-przyklad");

    // WHEN the event page groups its facts
    const sections = Object.fromEntries(eventSections(place, "pl").map((s) => [s.id, s.facts]));

    // THEN the entrance carries its known facts with sources and dates
    const door = sections.entrance.find((f) => f.attribute === "door_width_cm");
    expect(door).toMatchObject({ value: "90", unit: "cm", reliability: "confirmed", unknown: false });
    expect(door?.sources[0]).toMatchObject({ name: "Dane obiektu", date: "12.09.2026" });
    // AND the toilet and parking sections list unknowns as "brak danych", never as accessible
    expect(sections.toilet.map((f) => [f.attribute, f.unknown])).toEqual([
      ["toilet_accessible", false],
      ["changing_table", true],
    ]);
    expect(sections.parking).toEqual([expect.objectContaining({ attribute: "disabled_parking", unknown: true, reliability: "unknown" })]);
  });

  it("shows both sides of a conflict with their sources", async () => {
    // GIVEN a place where two sources disagree about the toilet
    const place = await examplePlace("palac-krzysztofory");

    // WHEN its facts are grouped
    const toilet = eventSections(place, "pl").find((s) => s.id === "toilet")?.facts[0];

    // THEN the row is a conflict and each source carries its own value
    expect(toilet).toMatchObject({ attribute: "toilet_accessible", reliability: "conflict", conflict: true });
    expect(toilet?.sources.map((s) => s.value)).toEqual(expect.arrayContaining(["Jest", "Nie ma"]));
  });
});

describe("nearbyStops", () => {
  const venue = { id: "palac-krzysztofory", location: { type: "Point" as const, coordinates: [19.9381, 50.0623] } };
  const stop = (id: string, lon: number, lat: number) =>
    ({ id, name: id, category: "transit_stop", location: { type: "Point", coordinates: [lon, lat] }, summary: [], verdict: null, isSample: false }) as unknown as PlaceSummary;

  it("keeps up to three stops within walking distance, nearest first, in whole metres", () => {
    // GIVEN four stops 350–400 m from Pałac Krzysztofory, listed out of order, and one 1.6 km away
    const stops = [
      stop("bagatela-01", 19.9326372, 50.0630118),
      stop("rondo-mogilskie-07", 19.9604166, 50.0655321),
      stop("wszystkich-swietych-01", 19.9383564, 50.0591657),
      stop("bagatela-02", 19.9333991, 50.0639304),
      stop("wszystkich-swietych-02", 19.9374741, 50.0590764),
    ];

    // WHEN the event page picks the stops to show
    const picked = nearbyStops(stops, venue);

    // THEN the three nearest within 400 m come first, the far one never
    expect(picked.map((p) => p.stop.id)).toEqual(["wszystkich-swietych-01", "wszystkich-swietych-02", "bagatela-02"]);
    expect(picked.every((p) => Number.isInteger(p.distance) && p.distance <= EVENT_STOP_RADIUS_M)).toBe(true);
  });

  it("gives nothing when no stop is in reach, so the page says there is no data", () => {
    // GIVEN only a stop 1.6 km away
    // WHEN the stops are picked
    // THEN none is shown
    expect(nearbyStops([stop("rondo-mogilskie-07", 19.9604166, 50.0655321)], venue)).toEqual([]);
  });

  it("never lists the venue itself when the venue is a stop", () => {
    // GIVEN the event venue is a stop, with another stop 350 m away
    const venueStop = { id: "here", location: { type: "Point" as const, coordinates: [19.9381, 50.0623] } };
    // WHEN the stops are picked
    const picked = nearbyStops([stop("here", 19.9381, 50.0623), stop("wszystkich-swietych-01", 19.9383564, 50.0591657)], venueStop);
    // THEN only the other one is shown
    expect(picked.map((p) => p.stop.id)).toEqual(["wszystkich-swietych-01"]);
  });

  it("asks the API only for stops in a box around the venue, nearest first", () => {
    // GIVEN the venue WHEN the query is built
    const query = nearbyStopsQuery(venue);
    // THEN it names the stop category and the venue point, and the box covers the walking radius but not the city
    expect(query).toMatchObject({ category: ["transit_stop"], near: [19.9381, 50.0623], limit: 4 });
    const [minLon, minLat, maxLon, maxLat] = query.bbox!;
    expect(minLat).toBeLessThan(50.0623 - EVENT_STOP_RADIUS_M / 111_320);
    expect(maxLat - minLat).toBeLessThan(0.01);
    expect(maxLon - minLon).toBeLessThan(0.015);
    expect(nearbyStops([stop("wszystkich-swietych-01", 19.9383564, 50.0591657)], venue)).toHaveLength(1);
    expect(19.9383564).toBeGreaterThan(minLon);
    expect(50.0591657).toBeGreaterThan(minLat);
  });
});
