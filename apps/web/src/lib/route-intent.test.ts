import { describe, expect, it } from "vitest";
import { routeIntent, routeTarget } from "./route-intent";

describe("routeIntent", () => {
  it.each([
    ["zaprowadź mnie do Sukiennic", "sukiennic"],
    ["Jak dojść do Dworca Głównego?", "dworca glownego"],
    ["trasa do Wawelu", "wawelu"],
    ["wyznacz trasę na Rynek", "rynek"],
  ])("reads the destination of %s", (query, expected) => {
    // GIVEN a spoken or typed route request
    // WHEN the intent is read
    // THEN only the destination is left
    expect(routeIntent(query)).toBe(expected);
  });

  it.each(["Sukiennice", "najbliższa toaleta", "zaprowadź mnie do", "pokaż mi Wawel", ""])(
    "ignores %j",
    (query) => {
      // GIVEN a query that is no route request
      // WHEN the intent is read
      // THEN there is none
      expect(routeIntent(query)).toBeNull();
    },
  );
});

describe("routeTarget", () => {
  const sukiennice = { name: "Sukiennice" };
  const other = { name: "Sukiennice Cafe" };

  it("points to the only hit", () => {
    // GIVEN a route request with one hit
    // WHEN the target is chosen
    // THEN it is that hit
    expect(routeTarget("zaprowadź mnie do Sukiennic", [sukiennice])).toBe(sukiennice);
  });

  it("points to the one hit named as asked among several", () => {
    // GIVEN several hits, one of them named exactly as asked
    // WHEN the target is chosen
    // THEN that one wins
    expect(routeTarget("trasa do Sukiennice", [other, sukiennice])).toBe(sukiennice);
  });

  it("offers nothing when several hits are equally likely", () => {
    // GIVEN several hits and no exact name
    // WHEN the target is chosen
    // THEN there is none
    expect(routeTarget("trasa do Sukienn", [sukiennice, other])).toBeNull();
  });

  it("offers nothing for a plain search or no hits", () => {
    // GIVEN a query that is no route request, or a request without hits
    // WHEN the target is chosen
    // THEN there is none
    expect(routeTarget("Sukiennice", [sukiennice])).toBeNull();
    expect(routeTarget("trasa do Sukiennic", [])).toBeNull();
  });
});
