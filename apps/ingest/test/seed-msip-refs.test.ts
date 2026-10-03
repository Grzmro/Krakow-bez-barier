import { readFileSync } from "node:fs";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, facts, places, sources } from "@krakow-bez-barier/db";
import { seedDemoData } from "@krakow-bez-barier/db/seed";
import demoPlaces from "../../../packages/db/seed/demo-places.json";
import { mapMsipToilet, msipToilets, type MsipToilet } from "../src/adapters/msip-toilets";
import { drizzleStore } from "../src/store";

const features = (
  JSON.parse(readFileSync(new URL("./fixtures/msip-toilets-sample.json", import.meta.url), "utf8")) as {
    features: MsipToilet[];
  }
).features;

const seededMsipFacts = demoPlaces.flatMap((p) =>
  p.facts.filter((f) => f.source === "msip-toilets").map((f) => ({ place: p.externalRef, ...f })),
);

describe("seeded MSIP facts are what the adapter writes", () => {
  it("has, for each seeded MSIP record, exactly the adapter's facts: same ref, attribute, value and evidence", () => {
    // GIVEN the MSIP facts of the demo seed, grouped by record, and the recorded MSIP layer
    const byRecord = Map.groupBy(seededMsipFacts, (f) => f.recordRef);

    // WHEN comparing each record with what the adapter maps from the same record
    const differences = [...byRecord].flatMap(([ref, seeded]) => {
      const oid = Number(ref.split("/").pop());
      const record = features.find((f) => f.attributes.ESRI_OID === oid);
      if (!record) return [`${ref}: not in the fixture`];
      const key = (f: { recordRef: string; attribute: string; value: unknown; evidence?: { comment?: string | null } | null }) =>
        JSON.stringify([f.recordRef, f.attribute, f.value, f.evidence?.comment ?? null]);
      const adapter = (mapMsipToilet(record).place?.facts ?? []).map(key).sort();
      const seed = seeded.map(key).sort();
      return JSON.stringify(adapter) === JSON.stringify(seed) ? [] : [`${ref}: seed ${seed.join(" | ")} != adapter ${adapter.join(" | ")}`];
    });

    // THEN the first ingest finds nothing to change in the seeded facts
    expect(byRecord.size).toBeGreaterThan(0);
    expect(differences).toEqual([]);
  });
});

// These tests delete the demo places and their facts, so they only run on a database named "...test...".
const rawUrl = process.env.TEST_DATABASE_URL;
const url = rawUrl && /test/i.test(new URL(rawUrl).pathname) ? rawUrl : undefined;

describe.skipIf(!url)("seed, then MSIP ingest on the same database (needs a scratch TEST_DATABASE_URL whose name contains \"test\", migrated)", () => {
  const { db, close } = createDb(url ?? "postgres://unused");
  const store = drizzleStore(db);
  const seedRefs = demoPlaces.map((p) => p.externalRef);

  async function cleanup() {
    const owned = await db.select({ id: places.id }).from(places).where(inArray(places.externalRef, seedRefs));
    const ids = owned.map((o) => o.id);
    if (ids.length > 0) await db.delete(facts).where(inArray(facts.placeId, ids));
    await db.delete(places).where(inArray(places.externalRef, seedRefs));
  }

  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await close();
  });

  it("keeps one active fact per place, attribute and MSIP record after the first ingest", async () => {
    // GIVEN the seeded demo data and MSIP record 26 (the Konopnickiej toilet), as the adapter maps it
    await seedDemoData(db);
    const record = features.find((f) => f.attributes.ESRI_OID === 26)!;
    const place = mapMsipToilet(record).place!;
    const meta = { ...msipToilets.meta, licenseConfirmed: true };

    // WHEN the MSIP adapter ingests that record
    await store.upsertSource(meta);
    await store.applyPlace(meta, place, new Date("2026-10-04T00:00:00Z"));

    // THEN the toilet still has exactly one active MSIP fact per attribute — refreshed, not doubled
    const [toilet] = await db.select().from(places).where(eq(places.externalRef, "osm:node/5270846528"));
    const active = await db
      .select()
      .from(facts)
      .where(and(eq(facts.placeId, toilet.id), eq(facts.sourceId, "msip-toilets"), eq(facts.status, "active")));
    const perAttribute = active.map((f) => f.attribute);
    expect(new Set(perAttribute).size).toBe(perAttribute.length);
    expect(active.every((f) => f.sourceRecordRef === "msip-toilets:WT_WC_2023/26")).toBe(true);
  });

  it("re-points MSIP facts that an older seed wrote with the unprefixed ref, keeping their id", async () => {
    // GIVEN a database seeded before the fix: the toilet's active changing-table fact has the old ref format
    await seedDemoData(db);
    const [toilet] = await db.select().from(places).where(eq(places.externalRef, "osm:node/274115139"));
    const where = and(eq(facts.placeId, toilet.id), eq(facts.sourceId, "msip-toilets"), eq(facts.attribute, "changing_table"));
    const [current] = await db.select().from(facts).where(where);
    await db.update(facts).set({ sourceRecordRef: "WT_WC_2023/2" }).where(eq(facts.id, current.id));

    // WHEN the seed runs again
    const { newFacts } = await seedDemoData(db);

    // THEN the same fact (and so its confirmations) is active again under the prefixed ref, nothing is added
    const rows = await db.select().from(facts).where(where);
    expect(newFacts).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: current.id, status: "active", sourceRecordRef: "msip-toilets:WT_WC_2023/2" });
  });

  it("supersedes the legacy row when a prefixed twin is already active, and a seed value that changed", async () => {
    // GIVEN a legacy-ref fact next to its prefixed twin, and a stored value that differs from the seed
    await seedDemoData(db);
    const [toilet] = await db.select().from(places).where(eq(places.externalRef, "osm:node/274115139"));
    const where = and(eq(facts.placeId, toilet.id), eq(facts.sourceId, "msip-toilets"), eq(facts.attribute, "changing_table"));
    await db.insert(facts).values({
      placeId: toilet.id,
      attribute: "changing_table",
      value: { kind: "boolean", boolean: false },
      sourceId: "msip-toilets",
      sourceRecordRef: "WT_WC_2023/2",
      fetchedAt: new Date("2026-10-03T00:00:00Z"),
      reliability: "confirmed",
    });
    await db.update(facts).set({ value: { kind: "boolean", boolean: false } }).where(and(where, eq(facts.status, "active"), eq(facts.sourceRecordRef, "msip-toilets:WT_WC_2023/2")));

    // WHEN the seed runs
    await seedDemoData(db);

    // THEN one active fact is left, with the seed's value, and nothing was deleted
    const rows = await db.select().from(facts).where(where);
    const active = rows.filter((r) => r.status === "active");
    expect(active).toHaveLength(1);
    expect(active[0].value).toEqual({ kind: "boolean", boolean: true });
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});
