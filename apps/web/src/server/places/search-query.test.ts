import { describe, expect, it } from "vitest";
import { createFakePlaceRepository, placeRecord } from "./fake-repository";
import { cleanSearchText, deinflectSearchText } from "./search-query";
import { listPlaces } from "./service";

const wawel = placeRecord({ name: "Zamek Królewski na Wawelu", street: null, houseNumber: null });
const sukiennice = placeRecord({ name: "Sukiennice", street: "Rynek Główny", houseNumber: "1" });
const rynek = placeRecord({ name: "Kawiarnia", street: "Rynek Główny", houseNumber: "5" });
const dworzec = placeRecord({ name: "Dworzec Główny", street: null, houseNumber: null });
const repository = createFakePlaceRepository([wawel, sukiennice, rynek, dworzec], []);
const deps = { repository, now: new Date("2026-10-03T00:00:00Z") };
const names = async (q: string, d = deps) => (await listPlaces({ q }, d)).items.map((p) => p.name).sort();

describe("cleanSearchText", () => {
  it.each([
    ["do Wawelu", "wawelu"],
    ["pokaż mi Sukiennice", "sukiennice"],
    ["Rynku Głównego.", "rynku glownego"],
    ["zaprowadź mnie do Dworca Głównego", "dworca glownego"],
    ["jak dojść do Rynku", "rynku"],
    ["gdzie jest Wawel?", "wawel"],
    ["na w przy Barbakan!", "barbakan"],
    ["  Floriańska  ", "florianska"],
    ["ul. Floriańska", "ul. florianska"],
    ["do", "do"],
  ])("turns %j into %j", (typed, expected) => {
    // GIVEN a typed or dictated query
    // WHEN the lead-in and edge punctuation are removed
    const cleaned = cleanSearchText(typed);

    // THEN what is left is the folded place phrase
    expect(cleaned).toBe(expected);
  });
});

describe("deinflectSearchText", () => {
  it.each([
    ["wawelu", "wawe"],
    ["dworca glownego", "dwor glow"],
    ["rynku", "ryn"],
    ["sukiennice", "sukienni"],
    ["dom", "dom"],
  ])("reduces %j to the prefix %j", (word, stem) => {
    // GIVEN an inflected form
    // WHEN it is de-inflected
    // THEN the stem is a prefix of the base form
    expect(deinflectSearchText(word)).toBe(stem);
  });
});

describe("listPlaces with a Polish query", () => {
  it.each([
    ["do Wawelu", ["Zamek Królewski na Wawelu"]],
    ["pokaż mi Sukiennice", ["Sukiennice"]],
    ["Rynku Głównego", ["Kawiarnia", "Sukiennice"]],
    ["Dworca Głównego", ["Dworzec Główny"]],
    ["zaprowadź mnie do Dworca Głównego.", ["Dworzec Główny"]],
  ])("finds the place for %j", async (q, expected) => {
    // GIVEN places with nominative names and addresses
    // WHEN the query is inflected, has a lead-in or trailing punctuation
    // THEN the matching places are found
    expect(await names(q)).toEqual(expected);
  });

  it("keeps the exact hit when the stem would match more", async () => {
    // GIVEN places where "dworzec" also matches a longer name
    const other = placeRecord({ name: "Dworcowa Kawiarnia", street: null, houseNumber: null });
    const d = { ...deps, repository: createFakePlaceRepository([dworzec, other], []) };

    // WHEN the exact word is searched
    // THEN the stem pass is not used
    expect(await names("dworzec", d)).toEqual(["Dworzec Główny"]);
  });

  it("returns nothing when neither form matches", async () => {
    // GIVEN no place called that
    // WHEN searching
    // THEN the list is empty, not everything
    expect(await names("do Kopca Kościuszki")).toEqual([]);
  });
});
