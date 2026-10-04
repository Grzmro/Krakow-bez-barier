import { describe, expect, it } from "vitest";
import { categories, hiddenCategoryIds, listedCategories, routeCategoryIds, type CategoryConfig } from "./categories";
import { responseExamples } from "./index";

describe("categories", () => {
  it("matches the listCategories example the mock API serves", () => {
    // GIVEN the shipped category config and the spec's example response
    const example = responseExamples.listCategories[200].default.items;

    // WHEN projecting the config the way GET /categories does
    const served = listedCategories.map(({ id, label, singularLabel, icon }) => ({ id, label, singularLabel, icon }));

    // THEN the example is the config, so the mocked UI can't drift from it
    expect(example).toEqual(served);
  });

  it("has unique ids", () => {
    // GIVEN the config WHEN counting ids THEN none repeats
    expect(new Set(categories.map((c) => c.id)).size).toBe(categories.length);
  });

  it("gives every listed category an OSM rule, or its chip would always show 0 places", () => {
    // GIVEN the categories GET /categories lists
    // WHEN looking for those the ingest cannot assign any element to
    const withoutRule = listedCategories.filter((c) => c.osm.length === 0).map((c) => c.id);

    // THEN there are none
    expect(withoutRule).toEqual([]);
  });
});

describe("hiddenCategoryIds", () => {
  const list: CategoryConfig[] = [
    { id: "museum", label: "Muzea", singularLabel: "Muzeum", icon: "bank", osm: [] },
    { id: "bench", label: "Ławki", singularLabel: "Ławka", icon: "armchair", osm: [], hiddenByDefault: true, feature: "bench" },
    { id: "transit_stop", label: "Przystanki", singularLabel: "Przystanek", icon: "bus", osm: [], hiddenByDefault: true },
    { id: "steps", label: "Schody", singularLabel: "Schody", icon: "stairs", osm: [], onRoutes: true },
  ];

  it("hides bulk and route categories when no feature is asked for", () => {
    // GIVEN no feature filter WHEN listing hidden ids THEN every hidden and route category is hidden
    expect(hiddenCategoryIds([], list)).toEqual(["bench", "transit_stop", "steps"]);
  });

  it("shows a hidden category whose feature the request filters by", () => {
    // GIVEN the bench filter WHEN listing hidden ids THEN benches are listed, the rest stays hidden
    expect(hiddenCategoryIds(["bench"], list)).toEqual(["transit_stop", "steps"]);
  });

  it("names the route categories", () => {
    // GIVEN the config WHEN asking for route categories THEN only bits of the way come back
    expect(routeCategoryIds(list)).toEqual(["steps"]);
    expect(routeCategoryIds()).toEqual(["steps", "kerb"]);
  });
});
