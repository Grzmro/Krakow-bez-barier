import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { categories } from "@krakow-bez-barier/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FetchedRecords } from "../src/adapter";
import { krakow } from "../src/cities/krakow";
import { osm } from "../src/adapters/osm";
import { downloadExtract, readOsmExtract } from "../src/adapters/osm-extract";
import { mapOsmElement, type OsmElement } from "../src/adapters/osm-map";
import { writeOsmPbf } from "./helpers/write-osm-pbf";

// Inside the Kraków demo box (50.045–50.06, 19.925–19.96) unless said otherwise.
const REPLICATED_AT = Date.UTC(2026, 9, 2, 20, 21, 34) / 1000;
const fixturePbf = () =>
  writeOsmPbf({
    replicationTimestamp: REPLICATED_AT,
    nodes: [
      { id: 1, lat: 50.05, lon: 19.94, version: 3, tags: { amenity: "restaurant", name: "Bistro", wheelchair: "yes" } },
      { id: 2, lat: 50.07, lon: 19.94, tags: { amenity: "restaurant", name: "Just north of the box" } },
      { id: 3, lat: 50.05, lon: 19.95, tags: { highway: "crossing" } },
      { id: 4, lat: 50.051, lon: 19.941 },
      { id: 5, lat: 50.053, lon: 19.941 },
      { id: 6, lat: 50.053, lon: 19.945 },
      { id: 7, lat: 50.2, lon: 19.94 },
      { id: 8, lat: 50.055, lon: 19.955 },
      { id: 9, lat: 50.057, lon: 19.957 },
    ],
    ways: [
      { id: 10, refs: [4, 5, 6, 4], version: 7, tags: { tourism: "museum", name: "Muzeum" } },
      { id: 11, refs: [2, 7], tags: { amenity: "restaurant", name: "Outside" } },
      { id: 12, refs: [8, 9] },
    ],
    relations: [
      {
        id: 20,
        members: [{ type: "way", ref: 12, role: "outer" }],
        version: 2,
        tags: { type: "multipolygon", amenity: "theatre", name: "Teatr" },
      },
    ],
  });

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "kbb-osm-extract-test-"));
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("readOsmExtract", () => {
  it("returns the city's category elements in the Overpass shape, with centres for ways and relations", async () => {
    // GIVEN a PBF extract with matching and non-matching elements in and around the box
    const file = path.join(dir, "fixture.osm.pbf");
    await writeFile(file, fixturePbf());
    // WHEN reading it for the Kraków box
    const { elements, replicatedAt } = await readOsmExtract(file, krakow.bbox, categories);
    // THEN only tagged category elements in the box come out, ways/relations centred on their bounding box
    expect(replicatedAt).toEqual(new Date("2026-10-02T20:21:34Z"));
    expect(elements).toEqual([
      { type: "node", id: 1, version: 3, lat: 50.05, lon: 19.94, tags: { amenity: "restaurant", name: "Bistro", wheelchair: "yes" } },
      { type: "way", id: 10, version: 7, center: { lat: 50.052, lon: 19.943 }, tags: { tourism: "museum", name: "Muzeum" } },
      {
        type: "relation",
        id: 20,
        version: 2,
        center: { lat: 50.056, lon: 19.956 },
        tags: { type: "multipolygon", amenity: "theatre", name: "Teatr" },
      },
    ]);
  });

  it("keeps to the city's categories", async () => {
    // GIVEN the same extract
    const file = path.join(dir, "fixture.osm.pbf");
    await writeFile(file, fixturePbf());
    // WHEN reading only museums
    const { elements } = await readOsmExtract(file, krakow.bbox, categories.filter((c) => c.id === "museum"));
    // THEN the restaurant and the theatre are left out
    expect(elements.map((e) => `${e.type}/${e.id}`)).toEqual(["way/10"]);
  });
});

const extractUrl = krakow.sourceConfig.osm!.extractUrl!;

function stubNetwork(options: { extract: "ok" | "down" }) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (url !== extractUrl || options.extract === "down") throw new TypeError("fetch failed");
    return new Response(fixturePbf(), { status: 200, headers: { "Last-Modified": "Fri, 02 Oct 2026 21:00:00 GMT" } });
  });
  return calls;
}

describe("osm adapter fallback", () => {
  it("reads the Geofabrik extract when Overpass is unreachable and tags the records with its date", async () => {
    // GIVEN Overpass unreachable, Geofabrik up and a download cache
    vi.stubEnv("INGEST_CACHE_DIR", dir);
    vi.stubEnv("OVERPASS_URL", "https://overpass.invalid/api/interpreter");
    const calls = stubNetwork({ extract: "ok" });
    // WHEN fetching OSM for Kraków
    const result = (await osm.fetch({ city: krakow, userAgent: "test" })) as FetchedRecords<OsmElement>;
    // THEN the records come from the extract with a note and record refs naming it
    expect(calls).toEqual(["https://overpass.invalid/api/interpreter", extractUrl]);
    expect(result.note).toBe("OSM (Geofabrik, ekstrakt z 2026-10-02)");
    expect(result.records.map((e) => `${e.type}/${e.id}`)).toEqual(["node/1", "way/10", "relation/20"]);
    const { place } = mapOsmElement(result.records[0]);
    expect(place?.externalRef).toBe("osm:node/1");
    expect(place?.facts[0].recordRef).toBe("osm:node/1@v3;geofabrik-2026-10-02");
  });

  it("reuses the cached extract on the next run without downloading it again", async () => {
    // GIVEN one run that downloaded the extract into the cache
    vi.stubEnv("INGEST_CACHE_DIR", dir);
    vi.stubEnv("OVERPASS_URL", "https://overpass.invalid/api/interpreter");
    stubNetwork({ extract: "ok" });
    await osm.fetch({ city: krakow, userAgent: "test" });
    // WHEN running again
    const calls = stubNetwork({ extract: "ok" });
    const result = (await osm.fetch({ city: krakow, userAgent: "test" })) as FetchedRecords<OsmElement>;
    // THEN only Overpass is tried and the extract is read from the cache
    expect(calls).toEqual(["https://overpass.invalid/api/interpreter"]);
    expect(result.records).toHaveLength(3);
  });

  it("fails with both errors when the extract is unreachable too", async () => {
    // GIVEN Overpass and Geofabrik both unreachable and nothing cached
    vi.stubEnv("INGEST_CACHE_DIR", dir);
    vi.stubEnv("OVERPASS_URL", "https://overpass.invalid/api/interpreter");
    stubNetwork({ extract: "down" });
    // WHEN fetching
    // THEN the error names both failures
    await expect(osm.fetch({ city: krakow, userAgent: "test" })).rejects.toThrow(
      "Overpass failed: fetch failed; extract failed: fetch failed",
    );
  });
});

describe("downloadExtract", () => {
  it("keeps using a copy older than a day when Geofabrik cannot be reached", async () => {
    // GIVEN a cached copy last checked two days ago
    const file = path.join(dir, "malopolskie-latest.osm.pbf");
    await writeFile(file, fixturePbf());
    const meta = { url: extractUrl, lastModified: "Fri, 02 Oct 2026 21:00:00 GMT", checkedAt: Date.now() - 2 * 86_400_000 };
    await writeFile(`${file}.meta.json`, JSON.stringify(meta));
    const calls = stubNetwork({ extract: "down" });
    // WHEN revalidating it
    const result = await downloadExtract(extractUrl, dir, "test");
    // THEN it tried the network and fell back to the cached copy
    expect(calls).toEqual([extractUrl]);
    expect(result).toEqual({ file, lastModified: new Date("2026-10-02T21:00:00Z") });
    expect(await readFile(file)).toEqual(fixturePbf());
  });

  it("revalidates an old copy with If-Modified-Since and keeps it on 304", async () => {
    // GIVEN a cached copy last checked two days ago and a server that says it is unchanged
    const file = path.join(dir, "malopolskie-latest.osm.pbf");
    await writeFile(file, fixturePbf());
    const meta = { url: extractUrl, lastModified: "Fri, 02 Oct 2026 21:00:00 GMT", checkedAt: Date.now() - 2 * 86_400_000 };
    await writeFile(`${file}.meta.json`, JSON.stringify(meta));
    const sent: (string | null)[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sent.push(new Headers(init.headers).get("If-Modified-Since"));
      return new Response(null, { status: 304 });
    });
    // WHEN revalidating it
    const result = await downloadExtract(extractUrl, dir, "test");
    // THEN the conditional request was sent and the copy is kept and marked as checked
    expect(sent).toEqual(["Fri, 02 Oct 2026 21:00:00 GMT"]);
    expect(result.file).toBe(file);
    const saved = JSON.parse(await readFile(`${file}.meta.json`, "utf8"));
    expect(Date.now() - saved.checkedAt).toBeLessThan(60_000);
  });
});
