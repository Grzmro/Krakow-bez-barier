import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  krakowPlToilets,
  mapKrakowPlToilet,
  parseToiletsPage,
  toiletRecords,
  type KrakowPlToiletRecord,
} from "../src/adapters/krakow-pl-toilets";
import { krakow } from "../src/cities/krakow";
import type { PagePlace } from "../src/cities/types";
import { adapters } from "../src/registry";

const html = readFileSync(new URL("./fixtures/krakow-pl-toilets.html", import.meta.url), "utf8");
const page = parseToiletsPage(html);
const config = krakow.sourceConfig["krakow-pl-toilets"]?.pages?.[0];
const records = config ? toiletRecords(config.url, page, config.places) : [];
const recordOf = (id: string) => {
  const found = records.find((r) => r.place.id === id);
  if (!found) throw new Error(`no record ${id}`);
  return found;
};
const valuesOf = (r: KrakowPlToiletRecord) =>
  Object.fromEntries((mapKrakowPlToilet(r).place?.facts ?? []).map((f) => [f.attribute, f.value]));

describe("parseToiletsPage", () => {
  it("reads all 65 listed toilets with their type, hours and facility, and the page's update date", () => {
    // GIVEN the recorded krakow.pl page
    // WHEN parsing it (done above)
    // THEN every entry is there and fields land on the right entry, also where "&nbsp;" or no space follows the colon
    expect(page.updatedAt?.toISOString()).toBe("2025-09-15T00:00:00.000Z");
    expect(page.entries).toHaveLength(65);
    expect(page.entries[0]).toEqual({
      heading: "Bulwar Czerwieński (ul. Powiśle)",
      type: "obsługowa",
      hours: "codziennie 9.00-24.00 (sierpień - październik), 9.00-21.00 (listopad - grudzień)",
      facility: "platforma",
    });
    expect(page.entries.find((e) => e.heading === "al. Róż (męski)")?.facility).toBe("schodołaz");
    expect(page.entries.find((e) => e.heading === "Park Lotników Polskich (al. Jana Pawła II)")?.facility).toBe("wjazd z poziomu 0");
    expect(page.entries.at(-1)?.heading).toBe("P+R Górka Narodowa");
  });
});

describe("toiletRecords", () => {
  it("pairs every configured toilet with its entry on the page", () => {
    // GIVEN the configured toilets and the recorded page
    // WHEN pairing them (done above)
    // THEN none of the configured headings is missing from the page
    expect(config?.places.length).toBeGreaterThan(20);
    expect(records).toHaveLength(config?.places.length ?? -1);
  });

  it("leaves out a configured toilet whose heading is no longer on the page, and says so", () => {
    // GIVEN a configured place whose heading the page does not have
    const gone: PagePlace = { ...recordOf("rynek-glowny").place, id: "gone", heading: "Nieistniejąca toaleta" };
    const log: string[] = [];

    // WHEN pairing
    const paired = toiletRecords("https://example.org", page, [gone], (m) => log.push(m));

    // THEN no record is made, so no fact can land on the wrong toilet
    expect(paired).toEqual([]);
    expect(log[0]).toContain("Nieistniejąca toaleta");
  });
});

describe("mapKrakowPlToilet", () => {
  it("maps the Sukiennice toilet to facts on the OSM toilet, dated by the page and quoting it", () => {
    // GIVEN the Rynek Główny entry ("platforma")
    const r = recordOf("rynek-glowny");

    // WHEN mapping it
    const { place, skipped } = mapKrakowPlToilet(r);

    // THEN it is an accessible toilet with a lift, attached to the OSM toilet, each fact with the page's date and words
    expect(skipped).toEqual([]);
    expect(place).toMatchObject({ externalRef: "krakow-pl-toilets:rynek-glowny", sameAs: "osm:node/3533569749", category: "toilet" });
    expect(valuesOf(r)).toEqual({
      toilet_accessible: { kind: "boolean", boolean: true },
      wheelchair_overall: { kind: "text", text: "yes" },
      lift: { kind: "boolean", boolean: true },
    });
    const lift = place?.facts.find((f) => f.attribute === "lift");
    expect(lift).toMatchObject({
      recordRef: "krakow-pl-toilets:rynek-glowny@2025-09-15",
      observedAt: new Date("2025-09-15T00:00:00Z"),
      evidence: {
        comment: "„Rynek Główny (Sukiennice) — udogodnienia dla osób z niepełnosprawnościami: platforma”",
        url: config?.url,
      },
    });
  });

  it("maps a ramp, a level entrance, and a stair climber as only limited access", () => {
    // GIVEN entries with "pochylnia", "wjazd z poziomu 0" and "schodołaz"
    const ramp = recordOf("konopnickiej");
    const level = recordOf("rynek-debnicki");
    const climber: KrakowPlToiletRecord = {
      ...ramp,
      entry: { heading: "al. Róż (męski)", type: "obsługowa", hours: null, facility: "schodołaz" },
    };

    // WHEN mapping them
    // THEN each facility maps to its attribute; the stair climber adds no attribute and makes access limited
    expect(valuesOf(ramp)).toMatchObject({ ramp: { kind: "boolean", boolean: true }, wheelchair_overall: { kind: "text", text: "yes" } });
    expect(valuesOf(level)).toMatchObject({ entrance_level: { kind: "boolean", boolean: true } });
    expect(valuesOf(climber)).toEqual({
      toilet_accessible: { kind: "boolean", boolean: true },
      wheelchair_overall: { kind: "text", text: "limited" },
    });
  });

  it("skips a facility it does not know instead of guessing", () => {
    // GIVEN an entry with an unknown facility
    const odd: KrakowPlToiletRecord = { ...recordOf("blonia"), entry: { heading: "X", type: null, hours: null, facility: "podnośnik" } };

    // WHEN mapping it
    const { place, skipped } = mapKrakowPlToilet(odd);

    // THEN only the list's own claim is kept and the value is reported
    expect(place?.facts.map((f) => f.attribute).sort()).toEqual(["toilet_accessible", "wheelchair_overall"]);
    expect(skipped).toEqual(["krakow-pl-toilets:blonia udogodnienia=podnośnik"]);
  });
});

describe("krakowPlToilets source", () => {
  it("is registered for Kraków with its non-commercial licence and terms", () => {
    // GIVEN the registry and the Kraków config
    // WHEN looking the source up
    const { meta } = adapters["krakow-pl-toilets"];

    // THEN it is ingested and says plainly that the licence is non-commercial and still to be confirmed
    expect(meta).toBe(krakowPlToilets.meta);
    expect(krakow.sources).toContain("krakow-pl-toilets");
    expect(meta).toMatchObject({ licenseConfirmed: true, baseReliability: "confirmed", termsUrl: "https://www.krakow.pl/start/3307,artykul,informacje_prawne.html" });
    expect(meta.license).toMatch(/niekomercyjn.*do potwierdzenia/);
  });
});
