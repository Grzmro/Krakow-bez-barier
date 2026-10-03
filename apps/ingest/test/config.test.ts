import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { categories, type CategoryConfig } from "@krakow-bez-barier/contracts";
import { buildQuery, cityCategories } from "../src/adapters/osm";
import { mapOsmElement } from "../src/adapters/osm-map";
import { loadCities } from "../src/cities";
import { krakow } from "../src/cities/krakow";
import { resolveTarget } from "../src/registry";

const bbox = krakow.bbox;
const fixtureCities = fileURLToPath(new URL("./fixtures/cities/", import.meta.url));

const bakery: CategoryConfig = {
  id: "bakery",
  label: "Piekarnie",
  singularLabel: "Piekarnia",
  icon: "map-pin",
  osm: [{ key: "shop", values: ["bakery"] }],
};
const node = (id: number, tags: Record<string, string>) => ({ type: "node" as const, id, lat: 50.05, lon: 19.94, tags });

describe("category config", () => {
  it("queries Overpass for a category added to the list, with no other code change", () => {
    // GIVEN the configured categories plus one new entry
    const extended = [...categories, bakery];

    // WHEN the query is built
    const query = buildQuery(bbox, extended);

    // THEN the new tag is in it, next to the existing ones, and the shipped query does not have it
    expect(query).toContain(`nwr["shop"~"^(bakery)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});`);
    expect(query).toContain('nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub)$"]');
    expect(buildQuery(bbox)).not.toContain("bakery");
  });

  it("maps an element of a newly added category to a place carrying that category id", () => {
    // GIVEN a bakery element that the shipped config does not know
    const bakeryElement = node(2, { shop: "bakery", name: "Piekarnia Rynek" });
    expect(mapOsmElement(bakeryElement).place).toBeNull();

    // WHEN it is mapped with the extended list
    const { place } = mapOsmElement(bakeryElement, [...categories, bakery]);

    // THEN it becomes a bakery
    expect(place).toMatchObject({ externalRef: "osm:node/2", name: "Piekarnia Rynek", category: "bakery" });
  });

  it("ships pharmacies as one config entry that both the query and the mapper use", () => {
    // GIVEN the shipped config
    // WHEN querying and mapping a pharmacy
    const query = buildQuery(bbox);
    const { place } = mapOsmElement(node(1, { amenity: "pharmacy", name: "Apteka Pod Orłem" }));

    // THEN the pharmacy tag is queried and the place is categorised
    expect(query).toContain('nwr["amenity"~"^(pharmacy)$"]');
    expect(place).toMatchObject({ category: "pharmacy", name: "Apteka Pod Orłem" });
    expect(categories.find((c) => c.id === "pharmacy")).toMatchObject({ label: "Apteki", icon: "pill" });
  });

  it("limits the query to a city's category subset", () => {
    // GIVEN a city that lists only pharmacies
    const city = { ...krakow, categories: ["pharmacy"] };

    // WHEN the query is built from the city's categories
    const query = buildQuery(city.bbox, cityCategories(city));

    // THEN only the pharmacy clause is present
    expect(query.match(/nwr\[/g)).toHaveLength(1);
    expect(query).toContain("pharmacy");
  });
});

describe("city config", () => {
  it("discovers every city file in a directory without registration", async () => {
    // GIVEN a directory holding one city file
    // WHEN the cities are loaded from it
    const cities = await loadCities(fixtureCities);

    // THEN the city is available by its id
    expect(Object.keys(cities)).toEqual(["gdansk-test"]);
    expect(cities["gdansk-test"].defaults.zoom).toBe(14);
  });

  it("ships at least Kraków and a second OSM-only city", async () => {
    // GIVEN the shipped city directory
    // WHEN it is loaded
    const cities = await loadCities();

    // THEN both are there, each with a language and defaults, and the second uses only OSM
    expect(Object.keys(cities)).toEqual(expect.arrayContaining(["krakow", "wroclaw"]));
    expect(cities.krakow).toMatchObject({ language: "pl", defaults: { zoom: 15 } });
    expect(cities.wroclaw.sources).toEqual(["osm"]);
  });

  it("resolves a run target for a discovered city and rejects unknown ones", async () => {
    // GIVEN the discovered fixture city
    const cities = await loadCities(fixtureCities);

    // WHEN the CLI registry resolves it, an unknown city and an unconfigured source
    const ok = resolveTarget(cities, "gdansk-test");
    const noCity = resolveTarget(cities, "nowhere");
    const noSource = resolveTarget(cities, "gdansk-test", "msip-toilets");

    // THEN only the configured city and source resolve
    expect(ok).toMatchObject({ city: { id: "gdansk-test" }, sourceIds: ["osm"] });
    expect(noCity).toMatchObject({ error: expect.stringContaining("gdansk-test") });
    expect(noSource).toMatchObject({ error: expect.stringContaining("msip-toilets") });
  });

  it("rejects a city that lists an unknown category or reuses an id", async () => {
    // GIVEN fixture directories with a broken city
    const bad = fileURLToPath(new URL("./fixtures/cities-invalid/", import.meta.url));

    // WHEN loading them
    // THEN the error names the problem instead of silently dropping the category
    await expect(loadCities(bad)).rejects.toThrow(/unknown categories nope/);
  });
});
