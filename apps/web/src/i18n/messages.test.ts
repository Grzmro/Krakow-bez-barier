import { describe, expect, it } from "vitest";
import { locales } from "./locale";
import { catalogs } from "./messages";

/** Every key path in a catalog, with the kind of value at its end (string, function, array, …). */
function shape(value: unknown, path = ""): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [`${path}:${Array.isArray(value) ? "array" : typeof value}`];
  }
  return Object.entries(value).flatMap(([key, child]) => shape(child, path ? `${path}.${key}` : key));
}

// Records keyed by data (category ids) may differ between languages; every other key must match.
const DATA_KEYED = /^place\.categoryNames\./;

describe("catalogs", () => {
  it("have the same keys and value kinds as the Polish catalog", () => {
    // GIVEN the Polish reference catalog
    const reference = shape(catalogs.pl).filter((key) => !DATA_KEYED.test(key));
    for (const locale of locales) {
      // WHEN another language's catalog is compared with it
      const actual = shape(catalogs[locale]).filter((key) => !DATA_KEYED.test(key));
      // THEN nothing is missing or extra
      expect(actual, locale).toEqual(reference);
    }
  });

  it("translate the status words that carry a verdict", () => {
    // GIVEN the English catalog
    const { common } = catalogs.en;
    // WHEN its status words are read
    // THEN they are English, and missing data never reads as accessible
    expect(common.status).toEqual({ met: "Meets", barrier: "Doesn't meet", conflict: "Conflicting", unknown: "No data" });
  });
});
