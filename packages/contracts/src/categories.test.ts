import { describe, expect, it } from "vitest";
import { categories } from "./categories";
import { responseExamples } from "./index";

describe("categories", () => {
  it("matches the listCategories example the mock API serves", () => {
    // GIVEN the shipped category config and the spec's example response
    const example = responseExamples.listCategories[200].default.items;

    // WHEN projecting the config the way GET /categories does
    const served = categories.map(({ id, label, singularLabel, icon }) => ({ id, label, singularLabel, icon }));

    // THEN the example is the config, so the mocked UI can't drift from it
    expect(example).toEqual(served);
  });

  it("has unique ids", () => {
    // GIVEN the config WHEN counting ids THEN none repeats
    expect(new Set(categories.map((c) => c.id)).size).toBe(categories.length);
  });
});
