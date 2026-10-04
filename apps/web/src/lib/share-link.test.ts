import { describe, expect, it } from "vitest";
import { parseStart, type RouteStart } from "./route-start";
import { isPersonalStart, isSharedLink, placeShareLink, routeShareLink } from "./share-link";

const ORIGIN = "https://krakow-bez-barier.example";
const me: RouteStart = { kind: "me", position: [19.937_812_3, 50.061_698_7] };

describe("placeShareLink", () => {
  it("links the permanent card with the shared marker and nothing personal", () => {
    // GIVEN a place id with characters that need escaping
    // WHEN the link is built
    const url = new URL(placeShareLink(ORIGIN, "palac krzysztofory"));

    // THEN it is the card path with only the shared marker
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe("/miejsca/palac%20krzysztofory");
    expect([...url.searchParams.keys()]).toEqual(["share"]);
  });
});

describe("routeShareLink", () => {
  it("leaves the exact position out without consent", () => {
    // GIVEN a start at the device position and no opt-in
    // WHEN the route link is built
    const url = new URL(routeShareLink(ORIGIN, { to: "sukiennice", start: me, includeStart: false }));

    // THEN the destination is there, the start and every digit of the position are not
    expect(url.searchParams.get("do")).toBe("sukiennice");
    expect(url.searchParams.has("z")).toBe(false);
    expect(url.toString()).not.toMatch(/19\.9|50\.0/);
  });

  it("adds the start rounded to about 100 m only with consent", () => {
    // GIVEN the same start and the sender's "Dołącz mój start"
    // WHEN the route link is built
    const url = new URL(routeShareLink(ORIGIN, { to: "sukiennice", start: me, includeStart: true }));

    // THEN the start is lat,lon with three decimals
    expect(url.searchParams.get("z")).toBe("50.062,19.938");
  });

  it("keeps a start that is not personal without asking", () => {
    // GIVEN the station and a place as starts
    // WHEN links are built without the opt-in
    const station = new URL(routeShareLink(ORIGIN, { start: { kind: "station" }, includeStart: false }));
    const place = new URL(routeShareLink(ORIGIN, { to: "a", start: { kind: "place", id: "b" }, includeStart: false }));

    // THEN both starts are in the link
    expect(station.searchParams.get("z")).toBe("station");
    expect(place.searchParams.get("z")).toBe("b");
  });

  it("never carries the needs profile", () => {
    // GIVEN every kind of start, with and without consent
    const starts: RouteStart[] = [{ kind: "none" }, { kind: "station" }, me, { kind: "place", id: "x" }];

    // WHEN links are built
    const links = starts.flatMap((start) => [true, false].map((includeStart) => routeShareLink(ORIGIN, { to: "y", start, includeStart })));

    // THEN no link has a profile parameter
    for (const link of links) {
      const keys = [...new URL(link).searchParams.keys()];
      expect(keys.every((key) => ["do", "z", "share"].includes(key))).toBe(true);
    }
  });

  it("reproduces the route when the recipient's screen reads it back", () => {
    // GIVEN a link shared with the start
    const url = new URL(routeShareLink(ORIGIN, { to: "sukiennice", start: me, includeStart: true }));

    // WHEN the route screen parses it
    const start = parseStart(url.searchParams.get("z") ?? undefined);

    // THEN it plans from the rounded point to the same place
    expect(start).toEqual({ kind: "point", position: [19.938, 50.062] });
    expect(url.searchParams.get("do")).toBe("sukiennice");
    expect(isSharedLink(url.searchParams.get("share") ?? undefined)).toBe(true);
  });
});

describe("isPersonalStart / isSharedLink", () => {
  it("flags positions only", () => {
    // GIVEN each start kind
    // WHEN checked
    // THEN only a position is personal
    expect(isPersonalStart(me)).toBe(true);
    expect(isPersonalStart({ kind: "point", position: [1, 2] })).toBe(true);
    expect(isPersonalStart({ kind: "station" })).toBe(false);
    expect(isPersonalStart({ kind: "none" })).toBe(false);
  });

  it("accepts only the marker value 1", () => {
    // GIVEN query values
    // WHEN read
    // THEN only "1" is a shared link
    expect(isSharedLink("1")).toBe(true);
    expect(isSharedLink(undefined)).toBe(false);
    expect(isSharedLink("0")).toBe(false);
    expect(isSharedLink(["1", "1"])).toBe(false);
  });
});
