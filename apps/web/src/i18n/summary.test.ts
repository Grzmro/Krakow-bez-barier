import { describe, expect, it } from "vitest";
import { catalogs } from "./messages";

const pl = catalogs.pl.summary.chip;
const en = catalogs.en.summary.chip;

describe("summary.chip", () => {
  it("names the feature and its value, in the words of the place card", () => {
    // GIVEN known values of each kind
    // WHEN they are turned into list chips
    // THEN each reads "cecha: wartość"
    expect(pl("step_count", "known", { kind: "number", number: 2 })).toBe("Wejście: 2 stopnie");
    expect(pl("step_count", "known", { kind: "number", number: 0 })).toBe("Wejście: bez stopni");
    expect(pl("lift", "known", { kind: "boolean", boolean: true })).toBe("Winda: jest");
    expect(pl("changing_table", "known", { kind: "boolean", boolean: false })).toBe("Przewijak: nie ma");
    expect(pl("door_width_cm", "known", { kind: "number", number: 80, unit: "cm" })).toBe("Szerokość drzwi: 80 cm");
    expect(pl("threshold_cm", "known", { kind: "number", number: 1.5, unit: "cm" })).toBe("Próg: 1,5 cm");
    expect(pl("surface", "known", { kind: "text", text: "cobblestone" })).toBe("Nawierzchnia dojścia: kostka brukowa");
  });

  it("says where a level entrance is, not a bare 'jest'", () => {
    // GIVEN a known level entrance (BIP: "Wejście/wyjście jest na poziomie gruntu.")
    // WHEN it is turned into a list chip
    // THEN the value names the ground level
    expect(pl("entrance_level", "known", { kind: "boolean", boolean: true })).toBe("Poziom wejścia: na poziomie gruntu");
    expect(en("entrance_level", "known", { kind: "boolean", boolean: false })).toBe("Entrance level: not at ground level");
  });

  it("says outdated, conflicting and missing data in words, never by colour alone", () => {
    // GIVEN a stale, a conflicting and an unknown attribute
    // WHEN they are turned into list chips
    // THEN the state is part of the text
    expect(pl("lift", "stale", { kind: "boolean", boolean: true })).toBe("Winda: jest · nieaktualne");
    expect(pl("toilet_accessible", "conflict", null)).toBe("Toaleta dostosowana: sprzeczne dane");
    expect(pl("step_count", "unknown", null)).toBe("Wejście: brak danych");
  });

  it("keeps the overall wheelchair tag as the card's sentence", () => {
    // GIVEN the overall tag "limited"
    // WHEN it is turned into a list chip
    // THEN it reads like the card, without a redundant feature name
    expect(pl("wheelchair_overall", "known", { kind: "text", text: "limited" })).toBe("Częściowo dostępne dla wózków");
  });

  it("labels chips the same way in English", () => {
    // GIVEN the English catalog
    // WHEN values are turned into chips
    // THEN they read "feature: value"
    expect(en("step_count", "known", { kind: "number", number: 1 })).toBe("Entrance: 1 step");
    expect(en("lift", "stale", { kind: "boolean", boolean: true })).toBe("Lift: yes · outdated");
    expect(en("door_width_cm", "known", { kind: "number", number: 90, unit: "cm" })).toBe("Door width: 90 cm");
  });
});
