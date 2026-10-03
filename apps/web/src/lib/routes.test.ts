import { describe, expect, it } from "vitest";
import { isDetailRoute, routes } from "./routes";

describe("isDetailRoute", () => {
  it("is true for a place card and an event page", () => {
    // GIVEN the paths of a place card and an event page
    // WHEN they are checked THEN both are detail pages
    expect(isDetailRoute(routes.place("sukiennice"))).toBe(true);
    expect(isDetailRoute(routes.event("sukiennice", { name: "Koncert" }).split("?")[0])).toBe(true);
  });

  it("is false for the home, route and menu pages", () => {
    // GIVEN top-level pages, which have their own way back or none is needed
    // WHEN they are checked THEN none is a detail page
    for (const path of [routes.home, routes.route(), routes.aboutData, routes.business]) {
      expect(isDetailRoute(path)).toBe(false);
    }
  });
});
