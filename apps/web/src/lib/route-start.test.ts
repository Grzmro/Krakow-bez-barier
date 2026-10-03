import { describe, expect, it } from "vitest";
import { NO_START, parseStart, startParam, startPosition, STATION } from "./route-start";
import { routes } from "./routes";

describe("parseStart", () => {
  it("reads a place id and `lat,lon` coordinates", () => {
    // GIVEN the two kinds of `?z=` a shared link carries
    // WHEN they are parsed
    // THEN the id names a place and the coordinates a point, as `[lon, lat]`
    expect(parseStart("kawiarnia-przyklad")).toEqual({ kind: "place", id: "kawiarnia-przyklad" });
    expect(parseStart("50.065,19.942")).toEqual({ kind: "point", position: [19.942, 50.065] });
  });

  it("gives no start, never Dworzec Główny, for a missing or unusable value", () => {
    // GIVEN no start, an empty one, coordinates off the globe and an absurdly long id
    const values = [undefined, "", "  ", "95.1,19.9", "50.1,190.5", "x".repeat(201)];

    // WHEN each is parsed
    // THEN there is no start, so the screen has to use the device position or ask for one
    for (const value of values) expect(parseStart(value)).toEqual(NO_START);
  });

  it("reads Dworzec Główny only when the link names it", () => {
    // GIVEN the link of a route started from the station
    // WHEN it is parsed and written back
    // THEN the station is the start, and the link keeps it
    expect(parseStart("station")).toEqual(STATION);
    expect(startParam(STATION)).toBe("station");
  });
});

describe("startPosition", () => {
  const station: [number, number] = [19.9461, 50.0668];

  it("is the device position when there is one", () => {
    // GIVEN a start at the device position
    // WHEN the position to plan from is chosen
    // THEN it is that position
    expect(startPosition({ kind: "me", position: [19.9, 50.1] }, station)).toEqual([19.9, 50.1]);
  });

  it("is nothing without a location and a chosen start, so the route is not planned", () => {
    // GIVEN no start (location denied, nothing picked)
    // WHEN the position to plan from is chosen
    // THEN there is none; the station is not substituted
    expect(startPosition(NO_START, station)).toBeNull();
  });

  it("uses the station only when it was picked, and a place once its position is known", () => {
    // GIVEN the station picked, a place from a link and the same place after it loaded
    // WHEN the positions are chosen
    // THEN the station is its position, the unloaded place has none yet and the loaded one has its own
    expect(startPosition(STATION, station)).toEqual(station);
    expect(startPosition({ kind: "place", id: "a" }, station)).toBeNull();
    expect(startPosition({ kind: "place", id: "a" }, station, [19.95, 50.06])).toEqual([19.95, 50.06]);
  });
});

describe("startParam", () => {
  it("rounds a position to three decimals (~100 m), so a link never carries the exact device position", () => {
    // GIVEN the device position, exact to the metre
    const start = { kind: "me" as const, position: [19.942_37, 50.064_81] as [number, number] };

    // WHEN it goes into the link
    const param = startParam(start);

    // THEN only the rounded `lat,lon` is there, and it reads back as the same point
    expect(param).toBe("50.065,19.942");
    expect(parseStart(param)).toEqual({ kind: "point", position: [19.942, 50.065] });
  });

  it("keeps a place's id and leaves no start out of the link", () => {
    // GIVEN a place start and no start
    // WHEN they go into the link
    // THEN the place is its id and no start is no parameter at all
    expect(startParam({ kind: "place", id: "kawiarnia-przyklad", name: "Kawiarnia Przykład" })).toBe("kawiarnia-przyklad");
    expect(startParam(NO_START)).toBeUndefined();
  });
});

describe("routes.route", () => {
  it("puts the destination and the start in the query", () => {
    // GIVEN a destination and a start, each optional
    // WHEN the route link is built
    // THEN each one present is a parameter, and coordinates keep their comma readable
    expect(routes.route()).toBe("/trasa");
    expect(routes.route("palac-krzysztofory")).toBe("/trasa?do=palac-krzysztofory");
    expect(routes.route(undefined, "50.065,19.942")).toBe("/trasa?z=50.065,19.942");
    expect(routes.route("a b", "kawiarnia-przyklad")).toBe("/trasa?do=a%20b&z=kawiarnia-przyklad");
  });
});
