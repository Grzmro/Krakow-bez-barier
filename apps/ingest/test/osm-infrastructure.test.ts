import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildQuery } from "../src/adapters/osm";
import { mapOsmElement, type OsmElement } from "../src/adapters/osm-map";
import { krakow } from "../src/cities/krakow";

// Recorded from Overpass on 2026-10-03 (Kraków, around the Old Town and Kazimierz), trimmed to one element per case.
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/overpass-krakow-infrastructure.json", import.meta.url), "utf8"),
) as { elements: OsmElement[] };

const element = (id: number) => {
  const el = fixture.elements.find((e) => e.id === id);
  if (!el) throw new Error(`fixture has no element ${id}`);
  return el;
};

const factsOf = (id: number) =>
  Object.fromEntries((mapOsmElement(element(id)).place?.facts ?? []).map((f) => [f.attribute, f.value]));

describe("OSM infrastructure beyond venues", () => {
  it("queries benches, lifts, steps, kerbs and disabled parking, car parks only with capacity:disabled", () => {
    // GIVEN the shipped category config WHEN the Kraków query is built
    const query = buildQuery(krakow.bbox);

    // THEN every new kind of element is asked for
    expect(query).toContain('nwr["amenity"~"^(bench)$"]');
    expect(query).toContain('nwr["highway"~"^(elevator)$"]');
    expect(query).toContain('nwr["highway"~"^(steps)$"]');
    expect(query).toContain('nwr["barrier"~"^(kerb)$"]');
    expect(query).toContain('nwr["parking_space"~"^(disabled)$"]');
    expect(query).toContain('nwr["amenity"~"^(parking)$"]["capacity:disabled"]');
  });

  it("maps a bench to a bench place with a bench fact and its check date", () => {
    // GIVEN an unnamed stone bench on the Rynek checked on 2023-03-29
    // WHEN it is mapped
    const { place } = mapOsmElement(element(1509251113));

    // THEN it is a bench place with a dated bench fact pointing at its OSM record
    expect(place).toMatchObject({ externalRef: "osm:node/1509251113", name: "Ławka", category: "bench" });
    expect(place?.facts).toEqual([
      { attribute: "bench", value: { kind: "boolean", boolean: true }, recordRef: "osm:node/1509251113", observedAt: new Date("2023-03-29T00:00:00Z"), evidence: null },
    ]);
    // AND a bench drawn as a way gets its centre
    expect(mapOsmElement(element(374517254)).place).toMatchObject({ category: "bench", location: { x: 19.9382614, y: 50.0621028 } });
  });

  it("maps disabled parking bays and car parks by their disabled capacity, saying no where there is none", () => {
    // GIVEN a disabled bay, a car park with 2 disabled spaces and car parks tagged with none
    // WHEN they are mapped
    const bay = mapOsmElement(element(9886421578)).place;
    const carPark = mapOsmElement(element(1192477773)).place;

    // THEN all are parking places; only the bay and the car park with spaces have disabled parking
    expect(bay).toMatchObject({ category: "parking", name: "Miejsce postojowe dla osób z niepełnosprawnościami" });
    expect(factsOf(9886421578)).toEqual({ disabled_parking: { kind: "boolean", boolean: true } });
    expect(carPark).toMatchObject({ category: "parking", name: "Parking" });
    expect(factsOf(1192477773)).toEqual({ disabled_parking: { kind: "boolean", boolean: true } });
    expect(mapOsmElement(element(6727595065)).place).toMatchObject({ name: "Kiss & Ride", category: "parking" });
    expect(factsOf(6727595065)).toEqual({ disabled_parking: { kind: "boolean", boolean: false } });
    expect(factsOf(1515551563)).toEqual({ disabled_parking: { kind: "boolean", boolean: false } });
  });

  it("maps a lift with its levels and wheelchair tag", () => {
    // GIVEN a lift between levels -1 and 0, designated for wheelchairs, and a bare lift node
    // WHEN they are mapped
    const lift = mapOsmElement(element(1433524720));

    // THEN both are lifts; the tagged one also says what OSM says about it, `designated` reported as unmappable
    expect(lift.place).toMatchObject({ category: "elevator", name: "Winda" });
    expect(factsOf(1433524720)).toEqual({ lift: { kind: "boolean", boolean: true }, levels: { kind: "number", number: 2, unit: "count" } });
    expect(lift.skipped).toContain("wheelchair=designated");
    expect(factsOf(601062457)).toEqual({ lift: { kind: "boolean", boolean: true } });
  });

  it("maps steps to their step count and ramp, never guessing a ramp from a bare or separate one", () => {
    // GIVEN 42 steps with no ramp, 81 steps with a separate ramp and 13 steps without a ramp tag
    // WHEN they are mapped
    const separate = mapOsmElement(element(395982452));

    // THEN each is a flight of steps with its count; `ramp=no` is no ramp, `separate` is skipped and reported
    expect(mapOsmElement(element(25516309)).place).toMatchObject({ category: "steps", name: "Schody", externalRef: "osm:way/25516309" });
    expect(factsOf(25516309)).toMatchObject({ step_count: { kind: "number", number: 42, unit: "count" }, ramp: { kind: "boolean", boolean: false } });
    expect(factsOf(395982452)).not.toHaveProperty("ramp");
    expect(factsOf(395982452)).toMatchObject({ step_count: { number: 81 } });
    expect(separate.skipped).toEqual(expect.arrayContaining(["ramp:wheelchair=separate", "incline=down"]));
    expect(factsOf(398831393)).toEqual({ step_count: { kind: "number", number: 13, unit: "count" } });
  });

  it("keeps kerbs whose height is known and skips the others", () => {
    // GIVEN a flush kerb, a raised kerb 0.4 m high and a raised kerb of unknown height
    // WHEN they are mapped
    const unknown = mapOsmElement(element(11544543270));

    // THEN flush is 0 cm, the measured one is 40 cm, and the unmeasured one is no place, its tag reported
    expect(mapOsmElement(element(2981720160)).place).toMatchObject({ category: "kerb", name: "Krawężnik" });
    expect(factsOf(2981720160)).toEqual({ kerb_height_cm: { kind: "number", number: 0, unit: "cm" } });
    expect(factsOf(3525090249)).toMatchObject({ kerb_height_cm: { kind: "number", number: 40, unit: "cm" } });
    expect(unknown).toEqual({ place: null, skipped: ["kerb=raised"] });
  });
});
