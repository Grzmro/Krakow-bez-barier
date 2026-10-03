import { describe, expect, it } from "vitest";
import { parseStart, startParam, STATION } from "./route-start";
import { routes } from "./routes";

describe("parseStart", () => {
  it("reads a place id and `lat,lon` coordinates", () => {
    // GIVEN the two kinds of `?z=` a shared link carries
    // WHEN they are parsed
    // THEN the id names a place and the coordinates a point, as `[lon, lat]`
    expect(parseStart("kawiarnia-przyklad")).toEqual({ kind: "place", id: "kawiarnia-przyklad" });
    expect(parseStart("50.065,19.942")).toEqual({ kind: "point", position: [19.942, 50.065] });
  });

  it("falls back to Dworzec Główny for a missing or unusable value", () => {
    // GIVEN no start, an empty one, coordinates off the globe and an absurdly long id
    const values = [undefined, "", "  ", "95.1,19.9", "50.1,190.5", "x".repeat(201)];

    // WHEN each is parsed
    // THEN the route starts at the station, so the link still opens a route
    for (const value of values) expect(parseStart(value)).toEqual(STATION);
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

  it("keeps a place's id and leaves the default start out of the link", () => {
    // GIVEN a place start and the default one
    // WHEN they go into the link
    // THEN the place is its id and the station is no parameter at all
    expect(startParam({ kind: "place", id: "kawiarnia-przyklad", name: "Kawiarnia Przykład" })).toBe("kawiarnia-przyklad");
    expect(startParam(STATION)).toBeUndefined();
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
