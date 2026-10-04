import { describe, expect, it } from "vitest";
import { licenseLang, sourceTextLang } from "./source-text";

describe("sourceTextLang", () => {
  it.each([
    ["BIP Małopolska: deklaracje dostępności podmiotów publicznych"],
    ["ZTP: Przystanki komunikacji miejskiej"],
    ["Ponowne wykorzystywanie informacji sektora publicznego GMK, pkt III — także do celów komercyjnych"],
    ["Zarząd Transportu Publicznego w Krakowie"],
  ])("marks the Polish source text %j as Polish on the English page only", (text) => {
    // GIVEN a source's own Polish text WHEN shown on each page
    // THEN only the English page marks it
    expect(sourceTextLang(text, "en")).toBe("pl");
    expect(sourceTextLang(text, "pl")).toBeUndefined();
  });

  it("marks an English attribution as English on the Polish page", () => {
    // GIVEN the attribution the OSM licence asks for, in English
    // WHEN / THEN it is marked on the Polish page and left alone on the English one
    expect(sourceTextLang("© OpenStreetMap contributors", "pl")).toBe("en");
    expect(sourceTextLang("© OpenStreetMap contributors", "en")).toBeUndefined();
  });
});

describe("licenseLang", () => {
  it("leaves our own translated licence wording unmarked", () => {
    // GIVEN the pending-licence note the API sends in English
    // WHEN / THEN it is page text, not source text
    expect(licenseLang("to be confirmed with the city", "en")).toBeUndefined();
  });

  it("marks a licence quoted from the source", () => {
    // GIVEN a licence the source wrote in Polish WHEN shown on the English page THEN it is marked Polish
    expect(licenseLang("Licencja niekomercyjna, do potwierdzenia: regulamin krakow.pl", "en")).toBe("pl");
  });
});
