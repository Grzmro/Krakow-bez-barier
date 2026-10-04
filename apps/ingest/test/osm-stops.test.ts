import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildQuery } from "../src/adapters/osm";
import { mapOsmElement, prepareOsmElements, type OsmElement } from "../src/adapters/osm-map";
import { krakow } from "../src/cities/krakow";

// Recorded from Overpass on 2026-10-04 with the adapter's two outputs: platforms at Rondo Mogilskie, Grota-Roweckiego
// (a bus_stop node and the platform outline, plus an unnamed shelter), Podgórze SKA, Rondo Grzegórzeckie and the two
// unnamed platforms of Cmentarz Batowice, then the stop_area relations naming them.
const fixture = JSON.parse(readFileSync(new URL("./fixtures/overpass-krakow-stops.json", import.meta.url), "utf8")) as {
  elements: OsmElement[];
};

const element = (type: OsmElement["type"], id: number) => {
  const el = fixture.elements.find((e) => e.type === type && e.id === id);
  if (!el) throw new Error(`fixture has no ${type} ${id}`);
  return el;
};

const factsOf = (el: OsmElement) =>
  Object.fromEntries((mapOsmElement(el).place?.facts ?? []).map((f) => [f.attribute, f.value]));

const yes = { kind: "boolean", boolean: true };
const no = { kind: "boolean", boolean: false };

describe("OSM public transport stops", () => {
  it("asks for platforms, then for the stop areas with their members", () => {
    // GIVEN the shipped category config WHEN the Kraków query is built
    const query = buildQuery(krakow.bbox);

    // THEN platforms are queried with the other categories, and stop areas are output with their members
    expect(query).toContain('nwr["public_transport"~"^(platform)$"]');
    expect(query).toMatch(/out meta center tags;\n\(\n {2}rel\["public_transport"="stop_area"\]\([^)]+\);\n\);\nout body;$/);
  });

  it("maps a platform to a transit stop with what OSM says about it, and no fact for a missing tag", () => {
    // GIVEN Rondo Mogilskie 07: wheelchair=yes, tactile_paving=no, bench and shelter, no surface tag
    // WHEN it is mapped
    const { place } = mapOsmElement(element("node", 13987866361));

    // THEN it is a named transit stop whose facts point at its OSM record; the overall tag stays text, never a pass
    expect(place).toMatchObject({ externalRef: "osm:node/13987866361", name: "Rondo Mogilskie 07", category: "transit_stop" });
    expect(factsOf(element("node", 13987866361))).toEqual({
      wheelchair_overall: { kind: "text", text: "yes" },
      bench: yes,
      tactile_paving: no,
      shelter: yes,
    });
    expect(place?.facts.every((f) => f.recordRef === "osm:node/13987866361")).toBe(true);
  });

  it("reads the platform surface and skips a shelter mapped separately instead of guessing", () => {
    // GIVEN Rondo Grzegórzeckie 06 with a surface, and Rondo Mogilskie 01 with shelter=separate
    // WHEN they are mapped
    const separate = mapOsmElement(element("way", 234100797));

    // THEN the surface is a fact, and `separate` is reported as unmappable, not as a shelter
    expect(factsOf(element("node", 13987927811))).toMatchObject({ surface: { kind: "text", text: "paving_stones" }, tactile_paving: yes });
    expect(factsOf(element("way", 234100797))).not.toHaveProperty("shelter");
    expect(separate.skipped).toContain("shelter=separate");
  });

  it("takes a shelter tagged as the platform itself as a shelter", () => {
    // GIVEN the unnamed amenity=shelter platform at Grota-Roweckiego
    // WHEN it is mapped on its own
    const { place } = mapOsmElement(element("node", 5013333774));

    // THEN it has a shelter, tactile paving and a bench, and the category's name for an unnamed stop
    expect(place?.name).toBe("Przystanek");
    expect(factsOf(element("node", 5013333774))).toEqual({ tactile_paving: yes, shelter: yes, bench: yes });
  });

  it("names unnamed platforms from their stop area and merges one stop mapped twice", () => {
    // GIVEN the whole recorded answer
    // WHEN it is prepared for mapping
    const prepared = prepareOsmElements(fixture.elements);
    const places = prepared.map((el) => mapOsmElement(el).place);

    // THEN no stop area is left as a record, and each stop is one transit stop
    expect(prepared.some((el) => el.type === "relation")).toBe(false);
    expect(places.every((p) => p?.category === "transit_stop")).toBe(true);
    expect(places.map((p) => p?.name).sort()).toEqual([
      "Cmentarz Batowice",
      "Cmentarz Batowice",
      "Grota-Roweckiego 02",
      "Grota-Roweckiego 05",
      "Podgórze SKA 06",
      "Rondo Grzegórzeckie 06",
      "Rondo Mogilskie 01",
      "Rondo Mogilskie 02",
      "Rondo Mogilskie 03",
      "Rondo Mogilskie 04",
      "Rondo Mogilskie 05",
      "Rondo Mogilskie 06",
      "Rondo Mogilskie 07",
      "Rondo Mogilskie 08",
      "Rondo Mogilskie 09",
      "Rondo Mogilskie Opera 02",
    ]);
    // AND the richer record of a stop mapped twice is kept: the bus_stop node over the outline, the busier bay
    const refs = places.map((p) => p?.externalRef);
    expect(refs).toContain("osm:node/5013333771");
    expect(refs).not.toContain("osm:way/299484708");
    expect(refs).toContain("osm:way/142847129");
    expect(refs).not.toContain("osm:way/142847135");
    // AND the unnamed shelter on the Grota-Roweckiego platform is not a stop of its own
    expect(refs).not.toContain("osm:node/5013333774");
  });

  it("keeps two stops of the same name that are far apart, and two close ones with different names", () => {
    // GIVEN two platforms named "A" 100 m apart, and "B 01" / "B 02" across the street
    const at = (id: number, lat: number, name?: string): OsmElement => ({
      type: "node",
      id,
      lat,
      lon: 19.94,
      tags: { public_transport: "platform", ...(name ? { name } : {}) },
    });
    const elements = [at(1, 50.05, "A"), at(2, 50.0509, "A"), at(3, 50.06, "B 01"), at(4, 50.0601, "B 02")];

    // WHEN they are prepared
    // THEN all four stay
    expect(prepareOsmElements(elements).map((el) => el.id)).toEqual([1, 2, 3, 4]);
  });
});
