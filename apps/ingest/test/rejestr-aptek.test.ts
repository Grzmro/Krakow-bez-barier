import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildOsmQuery,
  indexOsm,
  isOperatingInCity,
  mapRejestrApteka,
  parseRegisterCsv,
  rejestrAptek,
  resolvePharmacy,
  resolveRecords,
  streetKey,
  type RegisterPharmacy,
} from "../src/adapters/rejestr-aptek";
import type { OsmElement } from "../src/adapters/osm-map";
import { krakow } from "../src/cities/krakow";
import { adapters } from "../src/registry";

// A trimmed recording of the register export (2026-10-04): every column the adapter does not read is "REDACTED".
const csv = readFileSync(new URL("./fixtures/rejestr-aptek/register.csv", import.meta.url), "utf8");
// The Overpass answer of the same run, cut to 150 m around those pharmacies.
const elements = JSON.parse(readFileSync(new URL("./fixtures/rejestr-aptek/overpass.json", import.meta.url), "utf8"))
  .elements as OsmElement[];

const register = parseRegisterCsv(csv);
const operating = register.filter((p) => isOperatingInCity(p, krakow.name));
const osm = indexOsm(elements, krakow.name);
const pharmacy = (id: string) => {
  const found = register.find((p) => p.id === id);
  if (!found) throw new Error(`no pharmacy ${id}`);
  return found;
};

describe("parseRegisterCsv", () => {
  it("reads id, name, status, kind and address, and nothing about the people behind a pharmacy", () => {
    // GIVEN the recorded export with its full header
    // WHEN parsing it (done above)
    // THEN every row is read, a quoted name is unescaped, and no other column (manager, owner, permit notes) is kept
    expect(register).toHaveLength(12);
    expect(pharmacy("1034532")).toEqual({
      id: "1034532",
      name: 'Apteka "Pod Gwiazdą"',
      status: "AKTYWNA",
      kind: "APTEKA OGÓLNODOSTĘPNA",
      street: "Alberta Schweitzera",
      houseNumber: "7",
      postalCode: "30-695",
      town: "Kraków",
      county: "Kraków",
    });
    expect(JSON.stringify(register)).not.toContain("REDACTED");
    expect(pharmacy("1035190").name).toBe("");
  });

  it("refuses an export whose columns changed instead of reading the wrong ones", () => {
    // GIVEN an export without the street column
    const changed = csv.replace("nazwa_ulicy", "ulica");
    // WHEN / THEN parsing fails, naming the column
    expect(() => parseRegisterCsv(changed)).toThrow(/nazwa_ulicy/);
  });
});

describe("isOperatingInCity", () => {
  it("keeps only pharmacies open to the public that the register lists as operating in Kraków", () => {
    // GIVEN the recorded rows: 8 operating in Kraków, one closed, one temporarily closed, a hospital unit, one elsewhere
    // WHEN filtering (done above)
    // THEN only the 8 remain
    expect(operating.map((p) => p.id).sort()).toEqual(
      ["1034532", "1034578", "1034656", "1035190", "1056530", "1075679", "1076038", "1121550"].sort(),
    );
    expect(isOperatingInCity(pharmacy("1038152"), "Kraków")).toBe(false); // CZASOWO NIECZYNNA
    expect(isOperatingInCity(pharmacy("1113709"), "Kraków")).toBe(false); // DZIAŁ FARMACJI SZPITALNEJ
    expect(isOperatingInCity(pharmacy("1000015"), "Kraków")).toBe(false); // NIEAKTYWNA, Nowa Słupia
  });
});

describe("streetKey", () => {
  it("compares street names across sources without street types, titles or word order", () => {
    // GIVEN the register's and OSM's spellings WHEN keyed THEN they are equal
    expect(streetKey("Traugutta Romualda")).toBe(streetKey("Romualda Traugutta"));
    expect(streetKey("Aleja gen. Tadeusza Bora-Komorowskiego")).toBe(streetKey("aleja Tadeusza Bora-Komorowskiego"));
    expect(streetKey("Osiedle Złotej Jesieni")).toBe(streetKey("Złotej Jesieni"));
    expect(streetKey("Krakowska")).not.toBe(streetKey("Nowa Krakowska"));
  });
});

describe("resolvePharmacy", () => {
  it("puts a pharmacy on the OSM pharmacy with the same address", () => {
    // GIVEN ZiKO at Orzechowa 1, which OSM tags with that address
    // WHEN resolving it
    // THEN it is that OSM node
    expect(resolvePharmacy(pharmacy("1034656"), osm)).toMatchObject({ kind: "osm", ref: "osm:node/6376220787", by: "address" });
  });

  it("matches an address the register writes surname first", () => {
    // GIVEN Apteka SUPRA at "Traugutta Romualda 26" and OSM's "Romualda Traugutta 26"
    // WHEN / THEN it is the OSM pharmacy at that address
    expect(resolvePharmacy(pharmacy("1076038"), osm)).toMatchObject({ kind: "osm", ref: "osm:node/1708313807", by: "address" });
  });

  it("matches an OSM pharmacy of the same name near the address point, even 120 m away in a big building", () => {
    // GIVEN dr Zdrowie at Mackiewicza 17, whose OSM node has no address and sits ~120 m from the building's centre
    // WHEN / THEN the name decides
    expect(resolvePharmacy(pharmacy("1034578"), osm)).toMatchObject({ kind: "osm", ref: "osm:node/4192963800", by: "name" });
  });

  it("takes the nearest OSM pharmacy for a pharmacy the register does not name", () => {
    // GIVEN an unnamed register pharmacy at Kobierzyńska 100 and an OSM pharmacy a few metres from that address
    // WHEN / THEN it is matched by distance alone
    expect(resolvePharmacy(pharmacy("1035190"), osm)).toMatchObject({ kind: "osm", ref: "osm:node/3042830118", by: "distance" });
  });

  it("does not take a differently named OSM pharmacy next door; the register's one becomes a new place at the address point", () => {
    // GIVEN Apteka Słoneczna at Mieszczańska 2 and an OSM "Apteka Mieszczańska" within 25 m
    const resolution = resolvePharmacy(pharmacy("1056530"), osm);
    // WHEN / THEN it is placed on the OSM address point, not merged into the other pharmacy
    expect(resolution).toEqual({ kind: "address", location: { x: 19.9276526, y: 50.0458828 } });
  });

  it("does not place a pharmacy whose address OSM does not have", () => {
    // GIVEN GALEN at Sieroszewskiego 66, with no OSM address point
    // WHEN / THEN nothing is guessed
    expect(resolvePharmacy(pharmacy("1075679"), osm)).toEqual({ kind: "none" });
  });

  it("does not guess between two streets that share a last word", () => {
    // GIVEN "Krakowska 1" in the register and only "Nowa Krakowska 1" / "Stara Krakowska 1" far apart in OSM
    const p: RegisterPharmacy = { ...pharmacy("1034656"), street: "Wielka Krakowska", houseNumber: "1" };
    const index = indexOsm(
      [
        { type: "node", id: 1, lat: 50.0, lon: 19.9, tags: { "addr:street": "Nowa Krakowska", "addr:housenumber": "1" } },
        { type: "node", id: 2, lat: 50.05, lon: 19.95, tags: { "addr:street": "Stara Krakowska", "addr:housenumber": "1" } },
      ],
      "Kraków",
    );
    // WHEN / THEN it is not placed
    expect(resolvePharmacy(p, index)).toEqual({ kind: "none" });
  });
});

describe("indexOsm", () => {
  it("drops address points of another town inside the city's box", () => {
    // GIVEN the same address in Kraków and in Wieliczka
    const index = indexOsm(
      [
        { type: "node", id: 1, lat: 50.0, lon: 20.0, tags: { "addr:street": "Polna", "addr:housenumber": "2", "addr:city": "Wieliczka" } },
        { type: "way", id: 2, center: { lat: 50.06, lon: 19.94 }, tags: { "addr:place": "Osiedle Urocze", "addr:housenumber": "1" } },
      ],
      "Kraków",
    );
    // WHEN / THEN only the Kraków one (an "osiedle" with addr:place) is an address point
    expect(index.addresses).toEqual([{ street: "Osiedle Urocze", houseNumber: "1", location: { x: 19.94, y: 50.06 } }]);
  });
});

describe("mapRejestrApteka", () => {
  it("maps a matched pharmacy to a place without facts that points at the OSM pharmacy", () => {
    // GIVEN „Dr. Max” at Stawowa 61, matched by name
    const p = pharmacy("1121550");
    // WHEN mapping it
    const { place, skipped } = mapRejestrApteka({ pharmacy: p, resolution: resolvePharmacy(p, osm) });
    // THEN it carries no accessibility fact (the register has none) and the name loses its quotes
    expect(skipped).toEqual([]);
    expect(place).toEqual({
      externalRef: "rejestr-aptek:apteka/1121550",
      name: "Dr. Max",
      category: "pharmacy",
      location: { x: 19.900393, y: 50.0919292 },
      street: "Stawowa",
      houseNumber: "61",
      sameAs: "osm:node/10691742006",
      facts: [],
    });
  });

  it("names an unnamed pharmacy „Apteka”, never after its owner", () => {
    // GIVEN the unnamed pharmacy at Kobierzyńska 100
    const p = pharmacy("1035190");
    // WHEN / THEN
    expect(mapRejestrApteka({ pharmacy: p, resolution: resolvePharmacy(p, osm) }).place?.name).toBe("Apteka");
  });

  it("skips and counts a pharmacy it could not place", () => {
    // GIVEN GALEN, not placed
    const p = pharmacy("1075679");
    // WHEN mapping
    const result = mapRejestrApteka({ pharmacy: p, resolution: { kind: "none" } });
    // THEN there is no place and the run log says why
    expect(result.place).toBeNull();
    expect(result.skipped).toEqual(["rejestr-aptek:apteka/1075679 adres=Wacława Sieroszewskiego 66 (brak punktu adresowego w OSM)"]);
  });
});

describe("resolveRecords", () => {
  it("logs how many pharmacies landed on OSM pharmacies, became new places or were not placed", () => {
    // GIVEN the 8 operating pharmacies
    const log: string[] = [];
    // WHEN resolving them
    const records = resolveRecords(operating, osm, (m) => log.push(m));
    // THEN every one has a resolution and the counts add up
    expect(records).toHaveLength(8);
    expect(log[0]).toContain("8 operating pharmacies; on an OSM pharmacy 6 (address 2, name 3, distance 1)");
    expect(log[0]).toContain("new at an OSM address point 1, not placed 1");
  });
});

describe("buildOsmQuery", () => {
  it("asks for the city's pharmacies and the address points on the register's streets", () => {
    // GIVEN the operating pharmacies, one with quotes and a regex character in its street name
    const quoted: RegisterPharmacy = { ...operating[0], street: 'Ulica "Testowa" (dawna)' };
    // WHEN building the query
    const query = buildOsmQuery(krakow.bbox, [...operating, quoted]);
    // THEN pharmacies and addresses by each street's longest word (letters only) are requested
    const box = `${krakow.bbox.south},${krakow.bbox.west},${krakow.bbox.north},${krakow.bbox.east}`;
    expect(query).toContain(`nwr["amenity"="pharmacy"](${box});`);
    expect(query).toContain(`nwr["healthcare"="pharmacy"](${box});`);
    expect(query).toContain(
      `nwr["addr:housenumber"]["addr:street"~"(Kobierzyńska|Mackiewicza|Mieszczańska|Orzechowa|Schweitzera|Sieroszewskiego|Stawowa|Testowa|Traugutta)",i](${box});`,
    );
    expect(query).toContain('nwr["addr:housenumber"]["addr:place"~');
  });
});

describe("registration", () => {
  it("is a registered Kraków source with a confirmed CC BY 4.0 licence and its export URL in the city config", () => {
    // GIVEN the registry and the Kraków config WHEN / THEN
    expect(adapters["rejestr-aptek"]).toBe(rejestrAptek);
    expect(krakow.sources).toContain("rejestr-aptek");
    expect(krakow.sourceConfig["rejestr-aptek"]?.endpoint).toBe("https://rejestry.ezdrowie.gov.pl/api/ra/filegenerator/getcsv");
    expect(rejestrAptek.meta).toMatchObject({ licenseConfirmed: true, kind: "official_open_data", baseReliability: "confirmed" });
    expect(rejestrAptek.meta.license).toMatch(/^CC BY 4\.0/);
  });
});
