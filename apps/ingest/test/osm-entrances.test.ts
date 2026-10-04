import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { krakow } from "../src/cities/krakow";
import { osm } from "../src/adapters/osm";
import {
  attachEntrances,
  buildEntranceQuery,
  entrancesFromOverpass,
  insideOutline,
  type OsmEntrances,
  type OsmOutline,
  type OverpassEntranceElement,
} from "../src/adapters/osm-entrances";
import { entranceFacts, mapOsmElement, prepareOsmElements, type OsmElement } from "../src/adapters/osm-map";

const fixture = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "fixtures/overpass-krakow-entrances.json"), "utf8"),
) as { pois: { elements: OsmElement[] }; entrances: { elements: OverpassEntranceElement[] } };

const byId = (places: OsmElement[], type: OsmElement["type"], id: number) => places.find((p) => p.type === type && p.id === id)!;

describe("attachEntrances on recorded Overpass answers (Rynek Główny)", () => {
  const places = prepareOsmElements(fixture.pois.elements);
  const data = entrancesFromOverpass(fixture.entrances.elements);
  const { places: attached, stats } = attachEntrances(places, data);

  it("attaches an entrance on a church's own outline to the church", () => {
    // GIVEN the main entrance node of St Mary's Basilica, on the basilica's building way
    // WHEN attaching entrances
    const basilica = byId(attached, "way", 26195267);
    // THEN the basilica takes it, and its fact names the entrance's own record and kind
    expect(basilica.entrance?.id).toBe(2502923075);
    expect(mapOsmElement(basilica).place?.facts.filter((f) => f.entrance)).toEqual([
      {
        attribute: "wheelchair_overall",
        value: { kind: "text", text: "no" },
        recordRef: "osm:node/2502923075@v3",
        observedAt: null,
        evidence: null,
        entrance: "main",
      },
    ]);
  });

  it("gives a house door to the one venue inside the house, not to the square sharing its front", () => {
    // GIVEN an entrance with `width=1.53` on Kamienica Pod Świętą Anną, whose front is also Rynek Główny's outline
    // WHEN attaching entrances
    const amber = byId(attached, "node", 475613626);
    const square = byId(attached, "way", 201133718);
    // THEN the shop node inside the house takes it as a 153 cm door; the square takes nothing
    expect(amber.entrance?.id).toBe(3090820032);
    expect(mapOsmElement(amber).place?.facts.find((f) => f.entrance)).toMatchObject({
      attribute: "door_width_cm",
      value: { kind: "number", number: 153, unit: "cm" },
      entrance: "unspecified",
    });
    expect(square.entrance).toBeUndefined();
  });

  it("leaves an entrance of a building with several venues inside unattached", () => {
    // GIVEN the gate of Pałac Biskupi, a building with more than one venue node inside
    // WHEN attaching entrances
    // THEN no place takes it
    expect(attached.some((p) => p.entrance?.id === 2511223457)).toBe(false);
    expect(stats).toMatchObject({ entrances: 4, onOutline: 2, inBuilding: 1, ambiguous: 1, placesWithEntrance: 3 });
  });

  it("marks every place as checked for entrances", () => {
    // GIVEN the attached places WHEN mapping one without an entrance THEN it still says entrances were read
    expect(attached.every((p) => p.entrancesChecked)).toBe(true);
    expect(mapOsmElement(byId(attached, "way", 201133718)).place?.entrancesChecked).toBe(true);
  });
});

// A square building around (50.05, 19.94), about 70 × 70 m.
const square = (id: number, tags: Record<string, string>, nodes = [1, 2, 3, 4, 1]): OsmOutline => ({
  type: "way",
  id,
  tags,
  nodes,
  lines: [
    [
      [19.9395, 50.0497],
      [19.9405, 50.0497],
      [19.9405, 50.0503],
      [19.9395, 50.0503],
      [19.9395, 50.0497],
    ],
  ],
});
const entrance = (id: number, tags: Record<string, string>, lat = 50.0497, lon = 19.94): OsmElement => ({
  type: "node",
  id,
  version: 1,
  lat,
  lon,
  tags,
});
const cafe = (id: number, lat = 50.05, lon = 19.94): OsmElement => ({
  type: "node",
  id,
  lat,
  lon,
  tags: { amenity: "cafe", name: `Kawiarnia ${id}` },
});
const attach = (places: OsmElement[], data: OsmEntrances) => attachEntrances(places, data);

describe("attachEntrances", () => {
  it("attaches an entrance on no outline to the one place within 5 m", () => {
    // GIVEN an entrance 3 m from one café and 30 m from another
    const data = { entrances: [entrance(1, { entrance: "main", wheelchair: "yes" }, 50.05, 19.94)], outlines: [] };
    const near = cafe(10, 50.050027, 19.94);
    const far = cafe(11, 50.05027, 19.94);
    // WHEN attaching
    const { places, stats } = attach([near, far], data);
    // THEN only the near café takes it
    expect(places[0].entrance?.id).toBe(1);
    expect(places[1].entrance).toBeUndefined();
    expect(stats.nearby).toBe(1);
  });

  it("attaches nothing when two places are within 5 m", () => {
    // GIVEN an entrance between two cafés 2 m away each
    const data = { entrances: [entrance(1, { entrance: "main", wheelchair: "yes" }, 50.05, 19.94)], outlines: [] };
    // WHEN attaching
    const { places, stats } = attach([cafe(10, 50.050018, 19.94), cafe(11, 50.049982, 19.94)], data);
    // THEN neither takes it
    expect(places.some((p) => p.entrance)).toBe(false);
    expect(stats.ambiguous).toBe(1);
  });

  it("doesn't give the door of a building without venues to a venue next door", () => {
    // GIVEN an entrance on an empty building and a café 3 m away in the neighbouring building
    const data = {
      entrances: [entrance(1, { entrance: "main", wheelchair: "yes" })],
      outlines: [square(100, { building: "yes" }, [1, 2, 3, 4, 1])],
    };
    // WHEN attaching
    const { places, stats } = attach([cafe(10, 50.049673, 19.94)], data);
    // THEN the café takes nothing
    expect(places[0].entrance).toBeUndefined();
    expect(stats.unmatched).toBe(1);
  });

  it("never attaches a staff-only service door", () => {
    // GIVEN the only entrance of a café's building is a service door
    const data = {
      entrances: [entrance(1, { entrance: "service", wheelchair: "no" })],
      outlines: [square(100, { building: "yes" }, [1, 2, 3, 4, 1])],
    };
    // WHEN attaching THEN the café takes nothing, so a staff door never decides its verdict
    const { places, stats } = attach([cafe(10)], data);
    expect(places[0].entrance).toBeUndefined();
    expect(stats.otherKind).toBe(1);
  });

  it("gives a place with several entrances its single main one", () => {
    // GIVEN a building with one café inside, a main entrance and a service entrance on its outline
    const data = {
      entrances: [entrance(1, { entrance: "service", wheelchair: "no" }), entrance(2, { entrance: "main", wheelchair: "yes" })],
      outlines: [square(100, { building: "yes" }, [1, 2, 3, 4, 1])],
    };
    // WHEN attaching
    const { places } = attach([cafe(10)], data);
    // THEN the café takes the main entrance
    expect(places[0].entrance?.id).toBe(2);
  });

  it("gives no entrance to a place with several entrances and no single main one", () => {
    // GIVEN two side entrances of one café's building
    const data = {
      entrances: [entrance(1, { entrance: "secondary", wheelchair: "no" }), entrance(2, { entrance: "yes", wheelchair: "yes" })],
      outlines: [square(100, { building: "yes" }, [1, 2, 3, 4, 1])],
    };
    // WHEN attaching
    const { places, stats } = attach([cafe(10)], data);
    // THEN it takes none, so the two never stand as a conflict
    expect(places[0].entrance).toBeUndefined();
    expect(stats.placesAmbiguous).toBe(1);
  });

  it("skips stairwells, exits and entrances that are places themselves", () => {
    // GIVEN a stairwell entrance, an exit and a café node tagged as an entrance, all on the café's building
    const shopDoor = { ...cafe(3), tags: { amenity: "cafe", name: "Drzwi", entrance: "main", wheelchair: "yes" } };
    const data = {
      entrances: [entrance(1, { entrance: "staircase", wheelchair: "yes" }), entrance(2, { entrance: "exit", wheelchair: "no" }), shopDoor],
      outlines: [square(100, { building: "yes" }, [1, 2, 3, 4, 1])],
    };
    // WHEN attaching
    const { places, stats } = attach([cafe(10), shopDoor], data);
    // THEN no place takes any of them
    expect(places.some((p) => p.entrance)).toBe(false);
    expect(stats).toMatchObject({ otherKind: 2, isPlace: 1 });
  });

  it("never attaches an entrance to a monument or a hidden category", () => {
    // GIVEN a memorial plaque and a bench inside the building, and nothing else
    const plaque: OsmElement = { type: "node", id: 10, lat: 50.05, lon: 19.94, tags: { historic: "memorial", name: "Tablica" } };
    const bench: OsmElement = { type: "node", id: 11, lat: 50.0497, lon: 19.94, tags: { amenity: "bench" } };
    const data = { entrances: [entrance(1, { entrance: "main", wheelchair: "yes" })], outlines: [square(100, { building: "yes" })] };
    // WHEN attaching
    const { places } = attach([plaque, bench], data);
    // THEN neither takes it
    expect(places.some((p) => p.entrance)).toBe(false);
  });
});

describe("osm adapter with entrances", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  const city = { ...krakow, bbox: krakow.areas!.demo };
  const stubOverpass = (entrances: "ok" | "down") =>
    vi.stubGlobal("fetch", async (_url: string, init: { body: URLSearchParams }) => {
      const query = init.body.get("data") ?? "";
      if (!query.includes('node["entrance"]')) return Response.json(fixture.pois);
      if (entrances === "down") return new Response("busy", { status: 504, statusText: "Gateway Timeout" });
      return Response.json(fixture.entrances);
    });

  it("asks Overpass for the entrances too and attaches them", async () => {
    // GIVEN Overpass answering both queries with the recorded answers
    vi.stubEnv("INGEST_CACHE_DIR", undefined);
    vi.stubEnv("OVERPASS_URL", "https://overpass.test/api/interpreter");
    stubOverpass("ok");
    // WHEN fetching OSM
    const records = (await osm.fetch({ city, userAgent: "test" })) as OsmElement[];
    // THEN the basilica comes with its main entrance
    expect(byId(records, "way", 26195267).entrance?.id).toBe(2502923075);
  });

  it("keeps the places, unmarked, when the entrance query fails", async () => {
    // GIVEN Overpass answering the places but timing out on the entrances
    vi.stubEnv("INGEST_CACHE_DIR", undefined);
    vi.stubEnv("OVERPASS_URL", "https://overpass.test/api/interpreter");
    stubOverpass("down");
    const log: string[] = [];
    // WHEN fetching OSM
    const records = (await osm.fetch({ city, userAgent: "test", log: (m) => log.push(m) })) as OsmElement[];
    // THEN the places come without entrances and unchecked, so the last entrance facts stay
    expect(records.length).toBeGreaterThan(0);
    expect(records.some((r) => r.entrance || r.entrancesChecked)).toBe(false);
    expect(log.some((m) => m.startsWith("entrances not read"))).toBe(true);
  });
});

describe("insideOutline", () => {
  it("counts a courtyard (inner ring) as outside", () => {
    // GIVEN a building ring with a courtyard ring inside
    const outline = square(1, { building: "yes" });
    outline.lines.push([
      [19.9399, 50.0499],
      [19.9401, 50.0499],
      [19.9401, 50.0501],
      [19.9399, 50.0501],
      [19.9399, 50.0499],
    ]);
    // WHEN testing points THEN the courtyard is outside, the wing inside, the street outside
    expect(insideOutline(outline, 19.94, 50.05)).toBe(false);
    expect(insideOutline(outline, 19.9397, 50.05)).toBe(true);
    expect(insideOutline(outline, 19.95, 50.05)).toBe(false);
  });
});

describe("entrancesFromOverpass", () => {
  it("gives a multipolygon the nodes of its member ways that were read", () => {
    // GIVEN an entrance on a way that is the outer ring of a building multipolygon
    const elements: OverpassEntranceElement[] = [
      { type: "node", id: 1, lat: 50.05, lon: 19.94, tags: { entrance: "main", wheelchair: "yes" } },
      {
        type: "way",
        id: 10,
        nodes: [1, 2, 3, 1],
        geometry: [
          { lat: 50.05, lon: 19.94 },
          { lat: 50.051, lon: 19.94 },
          { lat: 50.051, lon: 19.941 },
          { lat: 50.05, lon: 19.94 },
        ],
      },
      {
        type: "relation",
        id: 20,
        tags: { type: "multipolygon", building: "yes" },
        members: [{ type: "way", ref: 10, role: "outer", geometry: [{ lat: 50.05, lon: 19.94 }, { lat: 50.051, lon: 19.94 }] }],
      },
    ];
    // WHEN converting
    const { entrances, outlines } = entrancesFromOverpass(elements);
    // THEN the entrance is read and the relation lies on its node
    expect(entrances.map((e) => e.id)).toEqual([1]);
    expect(outlines.find((o) => o.type === "relation")).toMatchObject({ id: 20, nodes: [1, 2, 3, 1] });
  });

  it("asks only for entrances with an accessibility tag", () => {
    // GIVEN the Kraków box WHEN building the query THEN it filters by the entrance tags and reads outline geometry
    const query = buildEntranceQuery({ south: 1, west: 2, north: 3, east: 4 });
    expect(query).toContain('node["entrance"](1,2,3,4)->.all;');
    expect(query).toContain('node.all["door:width"];');
    expect(query).toContain(".w out body geom;");
  });
});

describe("entranceFacts", () => {
  it("reads door width, steps, ramp and an automatic door, all marked with the entrance", () => {
    // GIVEN a side entrance with every tag we read
    const node = entrance(5, {
      entrance: "secondary",
      "door:width": "0.9 m",
      step_count: "2",
      "ramp:wheelchair": "yes",
      automatic_door: "motion",
      check_date: "2026-05-01",
    });
    const skipped: string[] = [];
    // WHEN mapping it
    const facts = entranceFacts(node, skipped);
    // THEN each fact carries the entrance kind, its record and check date
    expect(facts.map((f) => [f.attribute, f.value])).toEqual([
      ["ramp", { kind: "boolean", boolean: true }],
      ["step_count", { kind: "number", number: 2, unit: "count" }],
      ["door_width_cm", { kind: "number", number: 90, unit: "cm" }],
      ["automatic_door", { kind: "boolean", boolean: true }],
    ]);
    expect(facts.every((f) => f.entrance === "secondary" && f.recordRef === "osm:node/5@v1")).toBe(true);
    expect(facts[0].observedAt).toEqual(new Date("2026-05-01T00:00:00Z"));
    expect(skipped).toEqual([]);
  });

  it("skips values it can't read and never guesses", () => {
    // GIVEN odd values
    const skipped: string[] = [];
    // WHEN mapping
    const facts = entranceFacts(
      entrance(6, { entrance: "main", wheelchair: "designated", width: "wide", automatic_door: "maybe", ramp: "yes" }),
      skipped,
    );
    // THEN nothing is mapped, each value is reported
    expect(facts).toEqual([]);
    expect(skipped).toEqual(["wheelchair=designated", "ramp=yes", "width=wide", "automatic_door=maybe"]);
  });

  it("reads `automatic_door=no` as a door that does not open by itself", () => {
    // GIVEN WHEN THEN
    expect(entranceFacts(entrance(7, { entrance: "shop", automatic_door: "no" }), [])).toMatchObject([
      { attribute: "automatic_door", value: { kind: "boolean", boolean: false }, entrance: "shop" },
    ]);
  });
});
