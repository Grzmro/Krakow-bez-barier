import { describe, expect, it } from "vitest";
import { createApiClient, createMockFetch } from "@krakow-bez-barier/contracts";
import { withPlacesMocks } from "./mocks/mock-fetch";
import type { PlaceSummary } from "@krakow-bez-barier/contracts";
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
  const venue = { location: { type: "Point" as const, coordinates: [19.9381, 50.0623] } };
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

  it("asks the API for stops nearest the venue", () => {
    // GIVEN the venue WHEN the query is built THEN it names the stop category and the venue point
    expect(nearbyStopsQuery(venue)).toEqual({ category: ["transit_stop"], near: [19.9381, 50.0623], limit: 3 });
  });
});
