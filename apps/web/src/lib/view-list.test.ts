import { describe, expect, it } from "vitest";
import { FIT_TOP } from "./search-fit";
import { fitTargets, followedView, isPartial, listArea, nextTaggedView, pointsCut, roundView } from "./view-list";

describe("listArea", () => {
  it("follows the map view when there is no fixed search area", () => {
    // GIVEN the map moved to a new view and "W mojej okolicy" is off
    const view: [number, number, number, number] = [19.9, 50.0, 20.0, 50.1];

    // WHEN choosing the list's box
    // THEN it is that view, the same one the points load for
    expect(listArea(undefined, view)).toEqual(view);
  });

  it("keeps the fixed search area over the view", () => {
    // GIVEN "W mojej okolicy" with its coarse area
    const area: [number, number, number, number] = [19.93, 50.05, 19.96, 50.08];

    // WHEN the map is panned elsewhere
    // THEN the list stays on the area
    expect(listArea(area, [20, 50, 20.1, 50.1])).toEqual(area);
  });

  it("searches the whole city for a typed name, not the view", () => {
    // GIVEN the map on the Rynek and "Qubus" typed, "W mojej okolicy" off
    const view: [number, number, number, number] = [19.93, 50.057, 19.944, 50.066];

    // WHEN choosing the list's box
    // THEN there is none: the place may be anywhere in Kraków
    expect(listArea(undefined, view, "Qubus")).toBeUndefined();
    expect(listArea(undefined, view, "   ")).toEqual(view);
  });

  it("keeps the 'W mojej okolicy' area for a typed name", () => {
    // GIVEN the user turned on "W mojej okolicy" and typed a name
    const area: [number, number, number, number] = [19.93, 50.05, 19.96, 50.08];

    // WHEN choosing the list's box
    // THEN the area they asked for stays
    expect(listArea(area, [20, 50, 20.1, 50.1], "Qubus")).toEqual(area);
  });

  it("covers the whole city until the map reports a view", () => {
    // GIVEN no area and no view yet (map unavailable or still loading)
    // WHEN choosing the list's box
    // THEN there is none, so the list is not empty
    expect(listArea(undefined, null)).toBeUndefined();
  });
});

describe("fitTargets", () => {
  const named = (name: string, lon = 19.94) => ({ name, location: { coordinates: [lon, 50.06] } });
  const places = ["Muzeum Narodowe", "Muzeum Inżynierii i Techniki", "Muzeum Krakowa", "Muzeum Sztuki", "Muzeum Lotnictwa", "Muzeum Fotografii"].map(
    (name) => named(name),
  );

  it("fits every listed place while browsing", () => {
    // GIVEN a category browsed, no name typed
    // WHEN choosing what the map fits
    // THEN all of them
    expect(fitTargets("", places)).toBe(places);
  });

  it("fits every listed place for a single letter, which names no place", () => {
    // GIVEN "m" typed, the start of every museum's name
    // WHEN choosing what the map fits
    // THEN all of them, as while browsing
    expect(fitTargets("m", places)).toBe(places);
  });

  it("flies to the one place whose name the text starts", () => {
    // GIVEN "muzeum inzynierii" typed without Polish letters
    // WHEN choosing what the map fits
    // THEN only that museum
    expect(fitTargets("muzeum inzynierii", places)).toEqual([named("Muzeum Inżynierii i Techniki")]);
  });

  it("prefers the one exact name over several that start with the text", () => {
    // GIVEN "Qubus" and "Qubus Hotel Kraków" both found
    const hits = [named("Qubus Hotel Kraków"), named("Qubus")];

    // WHEN choosing what the map fits
    // THEN the exact one
    expect(fitTargets("qubus", hits)).toEqual([named("Qubus")]);
  });

  it("fits the best ranked matches near each other when no place stands out", () => {
    // GIVEN "muzeum" matching six museums close together, ranked by the API, and one far across town ranked second
    const ranked = [places[0], named("Muzeum Lotnictwa (oddział)", 20.05), ...places.slice(1)];

    // WHEN choosing what the map fits
    // THEN the best match and the next few near it, without the far one
    expect(fitTargets("muzeum", ranked)).toEqual(places.slice(0, FIT_TOP - 1));
  });
});

describe("roundView", () => {
  it("rounds to four decimals so a settled view repeats the same request", () => {
    // GIVEN two views a hair apart
    // WHEN rounding
    // THEN they are the same box
    expect(roundView([19.900001, 50.000002, 20.000004, 50.1000049])).toEqual(roundView([19.9000014, 50.0000024, 20.0000041, 50.1000041]));
  });
});

describe("isPartial", () => {
  it("is true when the area holds more places than were loaded", () => {
    // GIVEN 100 of 340 places loaded
    // THEN the list says "first 100 of 340"
    expect(isPartial(100, 340)).toBe(true);
  });

  it("is false when everything is loaded or the total is unknown", () => {
    // GIVEN all 12 loaded, or no response yet
    // THEN nothing is cut
    expect(isPartial(12, 12)).toBe(false);
    expect(isPartial(0, undefined)).toBe(false);
  });
});

describe("pointsCut", () => {
  it("reports how many points the server left out", () => {
    // GIVEN a truncated points response
    const points = { items: Array.from({ length: 3 }), total: 9, truncated: true };

    // WHEN asking what was cut
    // THEN shown and total are returned
    expect(pointsCut(points)).toEqual({ shown: 3, total: 9 });
  });

  it("is null for a complete response", () => {
    // GIVEN a complete response or none yet
    // THEN no note
    expect(pointsCut({ items: [], total: 0, truncated: false })).toBeNull();
    expect(pointsCut(undefined)).toBeNull();
  });
});

describe("followedView", () => {
  const hotelView: [number, number, number, number] = [19.93, 50.05, 19.94, 50.06];
  const fitView: [number, number, number, number] = [19.9, 50.0, 20.0, 50.1];

  it("does not limit a new search to the view the previous one left", () => {
    // GIVEN the map zoomed in on the hotel the previous search found
    const tagged = nextTaggedView(null, hotelView, true, "hotel");

    // WHEN the user picks the museums category
    // THEN its list is the whole search area, not the museums inside the hotel's view (none)
    expect(followedView(tagged, "museums")).toBeNull();
  });

  it("follows the view the camera moved to after the search's results arrived", () => {
    // GIVEN the museums' results arrived and the map fitted them
    const before = nextTaggedView(null, hotelView, true, "hotel");
    const tagged = nextTaggedView(before, fitView, true, "museums");

    // WHEN the list picks its box
    // THEN it is the fitted view, and later pans keep following
    expect(followedView(tagged, "museums")).toEqual(fitView);
    expect(followedView(nextTaggedView(tagged, hotelView, true, "museums"), "museums")).toEqual(hotelView);
  });

  it("keeps the tag when the map only redrew its pins", () => {
    // GIVEN a view followed for the museums
    const tagged = nextTaggedView(null, fitView, true, "museums");

    // WHEN new pins are drawn without a camera move, before or after a new search settled
    const redrawn = nextTaggedView(tagged, fitView, false, "toilets");

    // THEN nothing changes: the same object, still the museums' view
    expect(redrawn).toBe(tagged);
    expect(followedView(redrawn, "toilets")).toBeNull();
  });
});
