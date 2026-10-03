import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapOsmElement, parseCentimetres, storeysFromLevel, type OsmElement } from "../src/adapters/osm-map";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/overpass-krakow-sample.json", import.meta.url), "utf8"),
) as { elements: OsmElement[] };

const byId = (id: number) => {
  const el = fixture.elements.find((e) => e.id === id);
  if (!el) throw new Error(`fixture has no element ${id}`);
  return el;
};

describe("mapOsmElement", () => {
  it("maps wheelchair, toilet and check_date of a restaurant with provenance data", () => {
    // GIVEN the recorded OSM node "Kuchnia u Doroty"
    // WHEN mapping it
    const { place } = mapOsmElement(byId(2135606464));
    // THEN it is a restaurant with an overall fact and a toilet fact dated by check_date
    expect(place).toMatchObject({
      externalRef: "osm:node/2135606464",
      name: "Kuchnia u Doroty",
      category: "restaurant",
      street: "Augustiańska",
    });
    expect(place?.facts.map((f) => [f.attribute, f.value])).toEqual([
      ["wheelchair_overall", { kind: "text", text: "yes" }],
      ["toilet_accessible", { kind: "boolean", boolean: true }],
    ]);
    expect(place?.facts.every((f) => f.recordRef === "osm:node/2135606464")).toBe(true);
    expect(place?.facts[0].observedAt).toEqual(new Date("2025-09-11T00:00:00Z"));
  });

  it("keeps wheelchair=limited as limited and the description as evidence", () => {
    // GIVEN a museum tagged wheelchair=limited with a description
    // WHEN mapping it
    const { place } = mapOsmElement(byId(979972831));
    // THEN the value stays "limited" and the description is attached
    expect(place?.facts[0]).toMatchObject({
      attribute: "wheelchair_overall",
      value: { kind: "text", text: "limited" },
      evidence: { comment: "jest wyciągana dostawka na schody" },
    });
  });

  it("creates no facts for tags that are absent", () => {
    // GIVEN a hotel without any accessibility tag but wheelchair
    // WHEN mapping it
    const { place } = mapOsmElement(byId(5274182623));
    // THEN only the wheelchair fact exists — nothing is guessed
    expect(place?.facts.map((f) => f.attribute)).toEqual(["wheelchair_overall"]);
  });

  it("maps a toilet's changing table and reads a way's centre", () => {
    // GIVEN the Konopnickiej toilet node and the Qubus way
    const toilet = mapOsmElement(byId(5270846528)).place;
    const hotel = mapOsmElement(byId(85676236)).place;
    // THEN the changing table is a boolean fact and the way has a point location
    expect(toilet?.category).toBe("toilet");
    expect(toilet?.facts.find((f) => f.attribute === "changing_table")?.value).toEqual({
      kind: "boolean",
      boolean: true,
    });
    expect(hotel?.externalRef).toBe("osm:way/85676236");
    expect(hotel?.location.x).toBeTypeOf("number");
  });

  it("maps a relation to a museum", () => {
    // GIVEN the Muzeum Archeologiczne relation
    // WHEN mapping it
    const { place } = mapOsmElement(byId(1863002));
    // THEN it is a museum with wheelchair=no
    expect(place?.category).toBe("museum");
    expect(place?.facts[0].value).toEqual({ kind: "text", text: "no" });
  });

  it("puts the element version in the record reference when OSM provides it", () => {
    // GIVEN a node with a version
    const el: OsmElement = { ...byId(2135606464), version: 7 };
    // WHEN mapping it
    const { place } = mapOsmElement(el);
    // THEN facts reference the exact version and the place does not
    expect(place?.externalRef).toBe("osm:node/2135606464");
    expect(place?.facts[0].recordRef).toBe("osm:node/2135606464@v7");
  });

  it("maps measurements and skips values that don't fit, reporting them", () => {
    // GIVEN a node with a door width in metres, a kerb height, and unusable values
    const el: OsmElement = {
      type: "node",
      id: 1,
      lat: 50.05,
      lon: 19.94,
      tags: {
        name: "Test",
        amenity: "cafe",
        "door:width": "0.9",
        "kerb:height": "3 cm",
        step_count: "1e2",
        kerb: "raised",
        wheelchair: "designated",
        incline: "up",
      },
    };
    // WHEN mapping it
    const { place, skipped } = mapOsmElement(el);
    // THEN valid measurements become facts and the rest is skipped, not guessed
    expect(place?.facts.map((f) => [f.attribute, f.value])).toEqual([
      ["door_width_cm", { kind: "number", number: 90, unit: "cm" }],
      ["kerb_height_cm", { kind: "number", number: 3, unit: "cm" }],
    ]);
    expect(skipped).toEqual(["wheelchair=designated", "step_count=1e2", "incline=up"]);
  });

  it("skips implausible and unit-less large measurements instead of guessing", () => {
    // GIVEN a door width of "90" (cm or m?) and a 5 m kerb
    const el: OsmElement = {
      type: "node",
      id: 4,
      lat: 1,
      lon: 1,
      tags: { name: "x", amenity: "cafe", "door:width": "90", "kerb:height": "5 m", "capacity:disabled": "no", ramp: "yes" },
    };
    // WHEN mapping it
    const { place, skipped } = mapOsmElement(el);
    // THEN only the parking fact is created; plain ramp=yes is not a wheelchair ramp
    expect(place?.facts.map((f) => f.attribute)).toEqual(["disabled_parking"]);
    expect(skipped).toEqual(["door:width=90", "kerb:height=5 m"]);
  });

  it("maps the storeys of a venue from its level, or else from its building", () => {
    // GIVEN the recorded ground-floor café "Czarna kaczka" (level=0) and a museum building (building:levels=4)
    // WHEN mapping them
    const levels = (id: number) => mapOsmElement(byId(id)).place?.facts.find((f) => f.attribute === "levels");
    // THEN each has a storey count with the raw tag as evidence
    expect(levels(4986442006)).toMatchObject({ value: { kind: "number", number: 1, unit: "count" }, evidence: { comment: "level=0" } });
    expect(levels(1863002)).toMatchObject({ value: { kind: "number", number: 4, unit: "count" }, evidence: { comment: "building:levels=4" } });
  });

  it("prefers the venue's level over the building's and skips unreadable storeys", () => {
    // GIVEN a first-floor café in a five-storey building, and places with unreadable storey tags
    const node = (id: number, tags: Record<string, string>): OsmElement => ({
      type: "node",
      id,
      lat: 1,
      lon: 1,
      tags: { name: "x", amenity: "cafe", ...tags },
    });
    // WHEN mapping them
    const upstairs = mapOsmElement(node(5, { level: "1", "building:levels": "5" }));
    const badLevel = mapOsmElement(node(6, { level: "parter" }));
    const badBuilding = mapOsmElement(node(7, { "building:levels": "0" }));
    // THEN the venue's own level decides, and nothing is guessed from unreadable values
    expect(upstairs.place?.facts.map((f) => [f.attribute, f.value])).toEqual([["levels", { kind: "number", number: 2, unit: "count" }]]);
    expect(badLevel).toMatchObject({ place: { facts: [] }, skipped: ["level=parter"] });
    expect(badBuilding).toMatchObject({ place: { facts: [] }, skipped: ["building:levels=0"] });
  });

  it("skips unnamed non-toilet places and elements of unknown category", () => {
    // GIVEN an unnamed cafe and a bench
    const cafe: OsmElement = { type: "node", id: 2, lat: 1, lon: 1, tags: { amenity: "cafe" } };
    const bench: OsmElement = { type: "node", id: 3, lat: 1, lon: 1, tags: { amenity: "bench", name: "x" } };
    // WHEN mapping them
    // THEN neither becomes a place
    expect(mapOsmElement(cafe).place).toBeNull();
    expect(mapOsmElement(bench).place).toBeNull();
  });
});

describe("parseCentimetres", () => {
  it.each([
    ["0.9", 90],
    ["1,2 m", 120],
    ["85 cm", 85],
  ])("parses %s", (raw, cm) => {
    // GIVEN a measurement string WHEN parsing THEN centimetres
    expect(parseCentimetres(raw)).toBe(cm);
  });

  it("rejects free text", () => {
    // GIVEN a non-measurement WHEN parsing THEN null
    expect(parseCentimetres("narrow")).toBeNull();
  });
});

describe("storeysFromLevel", () => {
  it("counts the storeys a visitor may need to reach from the ground floor", () => {
    // GIVEN level values for one storey, upper and lower floors, lists and ranges
    // WHEN converting them
    // THEN the ground floor is always counted and mezzanines round outwards
    expect(storeysFromLevel("0")).toBe(1);
    expect(storeysFromLevel("1")).toBe(2);
    expect(storeysFromLevel("-1")).toBe(2);
    expect(storeysFromLevel("0;1")).toBe(2);
    expect(storeysFromLevel("0-2")).toBe(3);
    expect(storeysFromLevel("-2--1")).toBe(3);
    expect(storeysFromLevel("0.5")).toBe(2);
  });

  it("rejects free text", () => {
    // GIVEN level values that aren't numbers
    // WHEN converting them
    // THEN nothing is guessed
    expect(storeysFromLevel("parter")).toBeNull();
    expect(storeysFromLevel("0;")).toBeNull();
  });
});
