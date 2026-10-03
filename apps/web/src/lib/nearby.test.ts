import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { pl } from "@/i18n/pl";
import { config } from "./config";
import { KRAKOW_DISTRICTS } from "./districts";
import type { LocateFailure } from "./native/geolocation";
import { byDistance, listCentre, locateFailureText, searchArea, searchCentre, toLonLat } from "./nearby";

describe("locateFailureText", () => {
  const reasons: LocateFailure[] = ["denied", "off", "unavailable", "timeout", "insecure", "unsupported"];

  it("gives every failure its own message, in both languages", () => {
    // GIVEN every failure reason
    for (const t of [pl.nearby, en.nearby]) {
      // WHEN each is turned into text
      const messages = reasons.map((reason) => locateFailureText(reason, "other", t).message);

      // THEN no two reasons share a message
      expect(new Set(messages).size).toBe(reasons.length);
    }
  });

  it("tells an iPhone user and an Android user where to allow location", () => {
    // GIVEN a refused permission
    // WHEN the text is built for each device
    const iphone = locateFailureText("denied", "ios", pl.nearby);
    const android = locateFailureText("denied", "android", pl.nearby);
    const iosApp = locateFailureText("denied", "ios-app", pl.nearby);

    // THEN each names its own settings path
    expect(iphone).toEqual({ message: "Brak zgody na lokalizację.", help: expect.stringContaining("Witryny Safari") });
    expect(android.help).toContain("Uprawnienia → Lokalizacja");
    expect(iosApp.help).toContain("Ustawienia → Kraków bez barier");
  });

  it("gives an action for every failure the user can fix", () => {
    // GIVEN the failures a user can act on
    const fixable = reasons.filter((reason) => reason !== "unsupported");

    // WHEN their text is built / THEN each has a non-empty hint, and "unsupported" has none
    for (const reason of fixable) expect(locateFailureText(reason, "android", pl.nearby).help).toBeTruthy();
    expect(locateFailureText("unsupported", "android", pl.nearby).help).toBeNull();
  });
});

describe("KRAKOW_DISTRICTS", () => {
  it("lists the 18 districts, each a point inside Kraków", () => {
    // GIVEN / WHEN the district list
    // THEN it has all 18 with unique ids and points within the city's bounding box
    expect(KRAKOW_DISTRICTS).toHaveLength(18);
    expect(new Set(KRAKOW_DISTRICTS.map((d) => d.id)).size).toBe(18);
    for (const d of KRAKOW_DISTRICTS) {
      expect(d.latitude).toBeGreaterThan(49.96);
      expect(d.latitude).toBeLessThan(50.13);
      expect(d.longitude).toBeGreaterThan(19.79);
      expect(d.longitude).toBeLessThan(20.22);
    }
  });
});

const WAWEL = { latitude: 50.0541, longitude: 19.9354 };

describe("searchArea", () => {
  it("snaps the position to a 0.01° grid and spans about 2 km around it", () => {
    // GIVEN a device at Wawel
    // WHEN the search area is computed
    const area = searchArea(WAWEL);

    // THEN it is centred on the grid cell, not on the device
    expect(area).toEqual([19.91, 50.03, 19.97, 50.07]);
  });

  it("gives the same area for two positions in the same cell", () => {
    // GIVEN two positions a few hundred metres apart in one grid cell
    const a = { latitude: 50.0541, longitude: 19.9354 };
    const b = { latitude: 50.0512, longitude: 19.9389 };

    // WHEN their areas are computed
    // THEN the server cannot tell them apart
    expect(searchArea(a)).toEqual(searchArea(b));
  });
});

describe("searchCentre", () => {
  it("is the middle of the search area, never the device position", () => {
    // GIVEN a device at Wawel
    // WHEN the point the API orders from is computed
    const centre = searchCentre(WAWEL);

    // THEN it is the snapped grid point
    expect(centre).toEqual([19.94, 50.05]);
  });
});

describe("byDistance", () => {
  it("orders places nearest first with distances from the origin", () => {
    // GIVEN two places, the farther one listed first
    const far = { id: "rynek", location: { coordinates: [19.9373, 50.0614] } };
    const near = { id: "wawel", location: { coordinates: [19.9355, 50.0543] } };

    // WHEN they are ordered from Wawel
    const result = byDistance([far, near], toLonLat(WAWEL));

    // THEN the nearest comes first and each distance is in metres
    expect(result.map(({ place }) => place.id)).toEqual(["wawel", "rynek"]);
    expect(result[0].distance).toBe(20);
    expect(result[1].distance).toBeGreaterThan(700);
  });
});

describe("listCentre", () => {
  it("is the initial map view (the Rynek) without a position", () => {
    // GIVEN a visitor who has not shared their location
    // WHEN the point the home list orders from is computed
    const centre = listCentre(null);

    // THEN it is the city centre the map opens on, not an unordered page of the whole city
    expect(centre).toEqual(config.cityCenter);
  });

  it("is the snapped search centre with a position", () => {
    // GIVEN a device at Wawel
    // WHEN the point the home list orders from is computed
    const centre = listCentre(WAWEL);

    // THEN it is the coarse search centre, never the device position
    expect(centre).toEqual(searchCentre(WAWEL));
  });
});
