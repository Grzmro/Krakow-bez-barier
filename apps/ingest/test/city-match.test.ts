import { readFileSync } from "node:fs";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, facts, places, sources } from "@krakow-bez-barier/db";
import type { MappedPlace, SourceMeta } from "../src/adapter";
import { mapMsipToilet, msipToilets, type MsipToilet } from "../src/adapters/msip-toilets";
import { mapOsmElement, type OsmElement } from "../src/adapters/osm-map";
import { osm } from "../src/adapters/osm";
import { drizzleStore } from "../src/store";

const url = process.env.TEST_DATABASE_URL;

const load = <T>(name: string, key: string) =>
  (JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as Record<string, T[]>)[key];

// Test-only source ids and refs, so cleanup can never touch real OSM or MSIP rows.
const osmMeta: SourceMeta = { ...osm.meta, id: "match-test-osm" };
const msipMeta: SourceMeta = { ...msipToilets.meta, id: "match-test-msip", licenseConfirmed: true };

function retag(place: MappedPlace, prefix: string): MappedPlace {
  const swap = (ref: string) => ref.replace(/^[^:]+:/, `${prefix}:`);
  return { ...place, externalRef: swap(place.externalRef), facts: place.facts.map((f) => ({ ...f, recordRef: swap(f.recordRef) })) };
}

describe.skipIf(!url)("MSIP toilets matched to OSM (needs TEST_DATABASE_URL with migrations applied)", () => {
  const { db, close } = createDb(url ?? "postgres://unused");
  const store = drizzleStore(db);
  const fetchedAt = new Date("2026-10-03T00:00:00Z");
  const testSources = [osmMeta.id, msipMeta.id];

  async function cleanup() {
    const owned = await db.select({ id: facts.placeId }).from(facts).where(inArray(facts.sourceId, testSources));
    await db.delete(facts).where(inArray(facts.sourceId, testSources));
    const ids = [...new Set(owned.map((o) => o.id))];
    if (ids.length > 0) await db.delete(places).where(inArray(places.id, ids));
    await db.delete(sources).where(inArray(sources.id, testSources));
  }

  beforeAll(async () => {
    await cleanup();
    await store.upsertSource(osmMeta);
    await store.upsertSource(msipMeta);
  });
  afterAll(async () => {
    await cleanup();
    await close();
  });

  it("attaches the MSIP Konopnickiej toilet to the OSM toilet and keeps both changing-table values", async () => {
    // GIVEN the recorded OSM toilet node and the MSIP record 13 m away that disagrees on the changing table
    const osmElement = load<OsmElement>("overpass-krakow-sample.json", "elements").find((e) => e.id === 5270846528)!;
    const msipRecord = load<MsipToilet>("msip-toilets-sample.json", "features").find((f) => f.attributes.ESRI_OID === 26)!;
    const osmPlace = retag(mapOsmElement(osmElement).place!, osmMeta.id);
    const msipPlace = retag(mapMsipToilet(msipRecord).place!, msipMeta.id);

    // WHEN OSM is ingested first and MSIP after it
    await store.applyPlace(osmMeta, osmPlace, fetchedAt);
    await store.applyPlace(msipMeta, msipPlace, fetchedAt);

    // THEN there is one place, still named and owned by OSM, with no MSIP-only place created
    const [place] = await db.select().from(places).where(eq(places.externalRef, osmPlace.externalRef));
    expect(place).toBeDefined();
    expect(await db.select().from(places).where(eq(places.externalRef, msipPlace.externalRef))).toHaveLength(0);

    // AND both sources' changing-table facts are active on it, with opposite values
    const changingTable = await db
      .select()
      .from(facts)
      .where(and(eq(facts.placeId, place.id), eq(facts.attribute, "changing_table"), eq(facts.status, "active")));
    expect(changingTable.map((f) => [f.sourceId, f.value]).sort()).toEqual([
      [msipMeta.id, { kind: "boolean", boolean: false }],
      [osmMeta.id, { kind: "boolean", boolean: true }],
    ]);
    expect(changingTable.find((f) => f.sourceId === msipMeta.id)).toMatchObject({
      sourceRecordRef: "match-test-msip:WT_WC_2023/26",
      reliability: "confirmed",
      fetchedAt,
    });
  });

  it("re-running MSIP refreshes its facts instead of duplicating them", async () => {
    // GIVEN the MSIP record ingested once already
    const msipRecord = load<MsipToilet>("msip-toilets-sample.json", "features").find((f) => f.attributes.ESRI_OID === 26)!;
    const msipPlace = retag(mapMsipToilet(msipRecord).place!, msipMeta.id);
    // WHEN applying it again
    const changed = await store.applyPlace(msipMeta, msipPlace, new Date("2026-10-04T00:00:00Z"));
    // THEN nothing new is written
    expect(changed).toBe(0);
    const active = await db
      .select()
      .from(facts)
      .where(and(eq(facts.sourceId, msipMeta.id), eq(facts.status, "active")));
    expect(active).toHaveLength(msipPlace.facts.length);
  });
});
