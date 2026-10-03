import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildLayerQuery } from "../src/adapters/arcgis";
import { mapMsipToilet, msipToilets, type MsipToilet } from "../src/adapters/msip-toilets";
import { mapZdmkParkingSpace, splitAddress, zdmkParkingOzn, type ZdmkParkingSpace } from "../src/adapters/zdmk-parking-ozn";
import { mapZtpStop, ztpStops, type ZtpStop } from "../src/adapters/ztp-stops";
import { krakow } from "../src/cities/krakow";
import { adapters } from "../src/registry";

const load = <T>(name: string) =>
  (JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as { features: T[] }).features;

const toilets = load<MsipToilet>("msip-toilets-sample.json");
const parking = load<ZdmkParkingSpace>("zdmk-parking-ozn-sample.json");
const stops = load<ZtpStop>("ztp-stops-sample.json");

const toilet = (oid: number) => {
  const f = toilets.find((t) => t.attributes.ESRI_OID === oid);
  if (!f) throw new Error(`fixture has no toilet ${oid}`);
  return f;
};
const stop = (objectId: number) => {
  const f = stops.find((s) => s.attributes.OBJECTID === objectId);
  if (!f) throw new Error(`fixture has no stop ${objectId}`);
  return f;
};
const factsOf = (result: ReturnType<typeof mapMsipToilet>) =>
  result.place?.facts.map((f) => [f.attribute, f.value]);

describe("mapMsipToilet", () => {
  it("maps the Konopnickiej toilet with provenance and the original wording as evidence", () => {
    // GIVEN the recorded MSIP record 26 (ul. Konopnickiej, underpass)
    // WHEN mapping it
    const result = mapMsipToilet(toilet(26));
    // THEN it is a toilet with access, ramp and "no changing table", each citing the record
    expect(result.place).toMatchObject({
      externalRef: "msip-toilets:WT_WC_2023/26",
      name: "Toaleta publiczna: ul. Konopnickiej (przejście podziemne)",
      category: "toilet",
    });
    expect(factsOf(result)).toEqual([
      ["wheelchair_overall", { kind: "text", text: "yes" }],
      ["ramp", { kind: "boolean", boolean: true }],
      ["changing_table", { kind: "boolean", boolean: false }],
    ]);
    expect(result.place?.facts.every((f) => f.recordRef === "msip-toilets:WT_WC_2023/26")).toBe(true);
    expect(result.place?.facts[0].evidence).toEqual({
      comment: "MSIP: dostępność dla niepełnosprawnych: tak, oddzielnie; modyfikacja: pochylnia",
    });
    expect(result.skipped).toEqual([]);
  });

  it("has no observation date, because the layer has none per record", () => {
    // GIVEN every recorded toilet WHEN mapping THEN no fact claims when it was true
    const all = toilets.flatMap((t) => mapMsipToilet(t).place?.facts ?? []);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((f) => f.observedAt === null)).toBe(true);
  });

  it("reads a platform lift and a changing table, and keeps the location in WGS84", () => {
    // GIVEN record 2 (ul. Sienna, platform, changing table)
    const result = mapMsipToilet(toilet(2));
    // THEN the lift and changing table are facts and the name drops the trailing marker
    expect(result.place?.name).toBe("Toaleta publiczna: ul. Sienna (Planty)");
    expect(factsOf(result)).toContainEqual(["lift", { kind: "boolean", boolean: true }]);
    expect(factsOf(result)).toContainEqual(["changing_table", { kind: "boolean", boolean: true }]);
    expect(result.place?.location.x).toBeCloseTo(19.9418, 3);
    expect(result.place?.location.y).toBeCloseTo(50.0597, 3);
  });

  it("maps an accessible cubicle on the women's side only to limited, not yes", () => {
    // GIVEN the recorded toilets whose access reads "tak, po stronie damskiej"
    const womensSide = toilets.filter((t) => t.attributes.nplnsprw === "tak, po stronie damskiej");
    expect(womensSide.map((t) => t.attributes.ESRI_OID)).toEqual([2, 4, 5, 6]);
    // WHEN mapping them
    const overall = womensSide.map((t) => mapMsipToilet(t).place?.facts.find((f) => f.attribute === "wheelchair_overall"));
    // THEN each is limited and keeps the original wording as evidence
    expect(overall.map((f) => f?.value)).toEqual(Array(4).fill({ kind: "text", text: "limited" }));
    expect(overall[0]?.evidence?.comment).toBe(
      "MSIP: dostępność dla niepełnosprawnych: tak, po stronie damskiej; modyfikacja: platforma",
    );
  });

  it("maps level access to entrance_level, and maps 'nie' to no", () => {
    // GIVEN level access, and a record saying it is not accessible
    const level = mapMsipToilet(toilet(1));
    const no = mapMsipToilet({ ...toilet(1), attributes: { ...toilet(1).attributes, nplnsprw: "nie", rodz_npl: "-" } });
    // THEN level access is an entrance_level fact, and "nie" is a no
    expect(factsOf(level)).toEqual([
      ["wheelchair_overall", { kind: "text", text: "yes" }],
      ["entrance_level", { kind: "boolean", boolean: true }],
      ["changing_table", { kind: "boolean", boolean: true }],
    ]);
    expect(level.skipped).toEqual([]);
    expect(factsOf(no)?.[0]).toEqual(["wheelchair_overall", { kind: "text", text: "no" }]);
    expect(no.place?.facts[0].evidence?.comment).toBe("MSIP: dostępność dla niepełnosprawnych: nie");
  });

  it("skips values it cannot read, closed toilets and records without geometry", () => {
    // GIVEN an unknown access value and modification, a closed toilet, and a record without a point
    const odd = mapMsipToilet({
      ...toilet(1),
      attributes: { ...toilet(1).attributes, nplnsprw: "tak, częściowo", rodz_npl: "schodołaz", przewijak: null },
    });
    const closed = mapMsipToilet({ ...toilet(1), attributes: { ...toilet(1).attributes, status: "nie" } });
    const noPoint = mapMsipToilet({ ...toilet(1), geometry: null });
    // THEN nothing is guessed, and every dropped value is counted
    expect(odd.place?.facts).toEqual([]);
    expect(odd.skipped).toEqual(["nplnsprw=tak, częściowo", "rodz_npl=schodołaz"]);
    expect(closed).toEqual({ place: null, skipped: ["status=nie"] });
    expect(noPoint.place).toBeNull();
  });
});

describe("mapZdmkParkingSpace", () => {
  it("maps a parking space to a place with a disabled-parking fact and its address", () => {
    // GIVEN the recorded space ID_167 at św. Sebastiana 7
    // WHEN mapping it
    const { place } = mapZdmkParkingSpace(parking[0]);
    // THEN the place carries the address and one sourced fact
    expect(place).toMatchObject({
      externalRef: "zdmk-parking-ozn:space/ID_167",
      name: "Miejsce postojowe dla osób z niepełnosprawnościami: św. Sebastiana 7",
      category: "other",
      street: "św. Sebastiana",
      houseNumber: "7",
    });
    expect(place?.facts).toEqual([
      {
        attribute: "disabled_parking",
        value: { kind: "boolean", boolean: true },
        recordRef: "zdmk-parking-ozn:space/ID_167",
        observedAt: null,
        evidence: { comment: "ZDMK: miejsce postojowe dla osób z niepełnosprawnościami, św. Sebastiana 7" },
      },
    ]);
  });

  it("maps every recorded space and splits addresses without guessing a number", () => {
    // GIVEN all recorded spaces WHEN mapping THEN each yields a place
    expect(parking.every((p) => mapZdmkParkingSpace(p).place !== null)).toBe(true);
    // AND an address without a house number stays a street
    expect(splitAddress("Plac Wszystkich Świętych")).toEqual({ street: "Plac Wszystkich Świętych", houseNumber: null });
    expect(splitAddress("Krakusa 19a")).toEqual({ street: "Krakusa", houseNumber: "19a" });
  });
});

describe("mapZtpStop", () => {
  it("maps a stop with a bench outside the shelter, its platform surface and the edit date", () => {
    // GIVEN the recorded stop św. Wawrzyńca 01
    // WHEN mapping it
    const { place, skipped } = mapZtpStop(stop(5840));
    // THEN bench and surface are facts dated by the inventory edit
    expect(place).toMatchObject({
      externalRef: "ztp-stops:stop/816-01",
      name: "Przystanek św. Wawrzyńca 01",
      category: "other",
    });
    expect(place?.facts.map((f) => [f.attribute, f.value])).toEqual([
      ["bench", { kind: "boolean", boolean: true }],
      ["surface", { kind: "text", text: "paving_stones" }],
    ]);
    expect(place?.facts[0].observedAt).toEqual(new Date(1769514681505));
    expect(place?.facts[1].evidence).toEqual({ comment: "ZTP: nawierzchnia peronu: płyty_chodnikowe" });
    expect(skipped).toEqual(["Krawężnik_peronowy=tak"]);
  });

  it("says no bench only when there is neither a shelter nor a seat", () => {
    // GIVEN a stop with a shelter and no seats outside it, and one with neither
    const sheltered = mapZtpStop(stop(7068)).place;
    const bare = mapZtpStop(stop(7686)).place;
    // THEN the sheltered stop has no bench fact (the shelter may have one) and the bare one has "no"
    expect(sheltered?.facts.map((f) => f.attribute)).toEqual(["surface"]);
    expect(bare?.facts.find((f) => f.attribute === "bench")?.value).toEqual({ kind: "boolean", boolean: false });
  });

  it("counts kerb values and an ambiguous 'kostka' surface as skipped instead of guessing", () => {
    // GIVEN Filharmonia 04 (Kassel kerb, "kostka" platform) and Hala Targowa 71 (kerb "nie")
    // WHEN mapping them
    const filharmonia = mapZtpStop(stop(7686));
    const hala = mapZtpStop(stop(8055), new Date("2026-10-03T00:00:00Z"));
    // THEN neither kerb nor "kostka" becomes a fact, and each is reported
    expect(filharmonia.place?.facts.map((f) => f.attribute)).toEqual(["bench"]);
    expect(filharmonia.skipped).toEqual(["Nawierzchnia_peronu=kostka", "Krawężnik_peronowy=kassel-kerb"]);
    expect(hala.skipped).toEqual(["Krawężnik_peronowy=nie"]);
  });

  it("skips a platform once its validUntil date has passed", () => {
    // GIVEN Hala Targowa 71, a temporary stop valid until 2026-10-05
    // WHEN mapping it before and after that date
    const before = mapZtpStop(stop(8055), new Date("2026-10-04T00:00:00Z"));
    const after = mapZtpStop(stop(8055), new Date("2026-10-06T00:00:00Z"));
    // THEN it is a place before, and a counted skip after
    expect(before.place?.name).toBe("Przystanek Hala Targowa 71");
    expect(after).toEqual({ place: null, skipped: ["validUntil=2026-10-05T00:00:00.000Z"] });
  });

  it("skips suspended stops and falls back to GlobalID without a BusMan code", () => {
    // GIVEN a suspended stop and one without kod_busman or platform data
    const suspended = mapZtpStop(stop(5977));
    const noCode = mapZtpStop(stop(7873));
    // THEN the suspended one is dropped and the other is keyed by GlobalID without a surface
    expect(suspended).toEqual({ place: null, skipped: ["Grupa=KMK_zawieszony"] });
    expect(noCode.place?.externalRef).toBe("ztp-stops:stop/455f56e9-966e-4faf-98fe-13b8c7b00ff5");
    expect(noCode.place?.facts.map((f) => f.attribute)).toEqual(["bench"]);
  });
});

describe("city sources registration", () => {
  it("registers each city source with a licence status and a layer in the city config", () => {
    // GIVEN the three city adapters
    // THEN they are registered, configured for Kraków and not cleared for ingest yet
    for (const adapter of [msipToilets, zdmkParkingOzn, ztpStops]) {
      expect(adapters[adapter.meta.id]).toBe(adapter);
      expect(krakow.sources).toContain(adapter.meta.id);
      expect(krakow.sourceConfig[adapter.meta.id]?.endpoint).toMatch(/^https:\/\/.+\/(MapServer|FeatureServer)\/0$/);
      expect(adapter.meta).toMatchObject({ licenseConfirmed: false, kind: "official_open_data" });
      expect(adapter.meta.license).toMatch(/^To be confirmed/);
    }
  });

  it("queries a layer for the city bbox in WGS84", () => {
    // GIVEN a layer URL and the demo bbox WHEN building the query
    const url = new URL(buildLayerQuery("https://example.org/arcgis/rest/services/X/FeatureServer/0/", krakow.bbox));
    // THEN it is an envelope query with WGS84 in and out
    expect(url.pathname).toBe("/arcgis/rest/services/X/FeatureServer/0/query");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      geometry: "19.925,50.045,19.96,50.06",
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      outFields: "*",
      f: "json",
    });
  });
});
