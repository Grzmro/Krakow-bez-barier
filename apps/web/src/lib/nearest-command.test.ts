import { categories } from "@krakow-bez-barier/contracts";
import { describe, expect, it } from "vitest";
import { type NearestParse, parseNearestCommand } from "./nearest-command";

const list = categories.map(({ id, label, singularLabel }) => ({ id, label, singularLabel }));
const parse = (text: string) => parseNearestCommand(text, list);
const picked = (result: NearestParse) =>
  result?.kind === "nearest" ? { quick: result.command.quick?.id, category: result.command.category } : result;

describe("parseNearestCommand", () => {
  it.each([
    ["najbliższa toaleta", "toilet", "toilet"],
    ["Gdzie jest najbliższa apteka?", "pharmacy", "pharmacy"],
    ["apteka w pobliżu", "pharmacy", "pharmacy"],
    ["toalety koło mnie", "toilet", "toilet"],
    ["najbliższy szalet", "toilet", "toilet"],
    ["najbliższy przystanek", "transit_stop", "transit_stop"],
    ["nearest toilet", "toilet", "toilet"],
    ["pharmacy near me", "pharmacy", "pharmacy"],
  ])("turns %j into the home quick action for %s", (text, id, category) => {
    // GIVEN a "nearest" phrase with a category that has a home quick action, WHEN it is parsed
    const result = picked(parse(text));

    // THEN that quick action is picked, with the category it lists
    expect(result).toEqual({ quick: id, category });
  });

  it.each([
    ["winda w pobliżu", "lift"],
    ["najbliższa winda", "lift"],
    ["najbliższa ławka", "rest"],
    ["nearest elevator", "lift"],
  ])("turns %j into the %s quick action, which has no category", (text, id) => {
    // GIVEN a phrase naming a feature, not a category
    const result = picked(parse(text));

    // THEN the quick action for that feature is picked
    expect(result).toEqual({ quick: id, category: undefined });
  });

  it.each([
    ["najblizsza restauracja", "restaurant"],
    ["najbliższe miejsce parkingowe", "parking"],
    ["nearest museum", "museum"],
  ])("turns %j into the bare %s category when no quick action covers it", (text, id) => {
    // GIVEN a "nearest" phrase with a category the quick actions don't cover
    const result = picked(parse(text));

    // THEN only the category is picked
    expect(result).toEqual({ quick: undefined, category: id });
  });

  it("leaves an ordinary search alone", () => {
    // GIVEN a place name or a bare category without a "nearest" phrase
    // WHEN parsed
    // THEN there is no command: it stays a text search
    expect(parse("Sukiennice")).toBeNull();
    expect(parse("toaleta")).toBeNull();
    expect(parse("")).toBeNull();
  });

  it("recognises a nearest request it cannot place", () => {
    // GIVEN "nearest" with a word that is no category or feature
    // WHEN parsed
    // THEN it is flagged, so the UI can suggest example commands instead of searching the text
    expect(parse("najbliższy smok")).toEqual({ kind: "unknown" });
    expect(parse("najbliższe miejsce")).toEqual({ kind: "unknown" });
    expect(parse("najbliższy przewijak")).toEqual({ kind: "unknown" });
  });
});
