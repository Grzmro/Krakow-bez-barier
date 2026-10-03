import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, facts, ingestionRuns, places, sources } from "@krakow-bez-barier/db";
import type { MappedPlace, SourceMeta } from "../src/adapter";
import { krakow } from "../src/cities/krakow";
import { runIngest } from "../src/runner";
import { drizzleStore, namesMatch } from "../src/store";

const url = process.env.TEST_DATABASE_URL;
const meta: SourceMeta = {
  id: "store-test",
  name: "Store test",
  kind: "community",
  url: "https://example.org",
  license: "CC0",
  licenseConfirmed: true,
  attribution: "Test",
  refreshInterval: "daily",
  baseReliability: "community",
};

const place = (text: string, ref = "store-test:node/1@v1", extra: Partial<MappedPlace> = {}): MappedPlace => ({
  externalRef: "store-test:node/1",
  name: "Testowa Kawiarnia",
  category: "restaurant",
  location: { x: 19.94, y: 50.05 },
  street: null,
  houseNumber: null,
  facts: [
    {
      attribute: "wheelchair_overall",
      value: { kind: "text", text },
      recordRef: ref,
      observedAt: null,
      evidence: null,
    },
  ],
  ...extra,
});

describe("namesMatch", () => {
  it("matches names ignoring case, diacritics and punctuation", () => {
    // GIVEN two spellings of one name WHEN comparing THEN they match
    expect(namesMatch("Kuchnia u Doroty", "kuchnia u doroty!")).toBe(true);
    expect(namesMatch("Pałac Biskupa Erazma Ciołka", "Palac Biskupa Erazma Ciolka")).toBe(true);
    expect(namesMatch("Kazimir", "Rzeźnia")).toBe(false);
  });
});

describe.skipIf(!url)("drizzleStore (needs TEST_DATABASE_URL with migrations applied)", () => {
  const { db, close } = createDb(url ?? "postgres://unused");
  const store = drizzleStore(db);
  const at = (n: number) => new Date(`2026-10-0${n}T00:00:00Z`);

  const activeFacts = async () => {
    const [p] = await db.select().from(places).where(eq(places.externalRef, "store-test:node/1"));
    return db
      .select()
      .from(facts)
      .where(and(eq(facts.placeId, p.id), eq(facts.sourceId, meta.id), eq(facts.status, "active")));
  };

  async function cleanup() {
    await db.delete(facts).where(eq(facts.sourceId, meta.id));
    const ps = await db.select().from(places).where(eq(places.externalRef, "store-test:node/1"));
    for (const p of ps) await db.delete(facts).where(eq(facts.placeId, p.id));
    await db.delete(places).where(eq(places.externalRef, "store-test:node/1"));
    await db.delete(ingestionRuns).where(eq(ingestionRuns.sourceId, meta.id));
    await db.delete(sources).where(eq(sources.id, meta.id));
  }

  beforeAll(async () => {
    await cleanup();
    await store.upsertSource(meta);
  });
  afterAll(async () => {
    await cleanup();
    await close();
  });

  it("inserts a place and its facts with provenance", async () => {
    // GIVEN a new mapped place
    // WHEN applying it
    const changed = await store.applyPlace(meta, place("yes"), at(1));
    // THEN the fact is stored with source, record ref, fetchedAt and reliability
    expect(changed).toBe(1);
    const [fact] = await activeFacts();
    expect(fact).toMatchObject({
      sourceId: "store-test",
      sourceRecordRef: "store-test:node/1@v1",
      reliability: "community",
      fetchedAt: at(1),
    });
  });

  it("refreshes an unchanged fact in place, even when the version changes", async () => {
    // GIVEN the same value in a later run and a newer element version
    const changed = await store.applyPlace(meta, place("yes", "store-test:node/1@v2"), at(2));
    // THEN nothing new is inserted; fetchedAt and the record ref are refreshed
    expect(changed).toBe(0);
    const rows = await activeFacts();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fetchedAt: at(2), sourceRecordRef: "store-test:node/1@v2" });
  });

  it("keeps the community confirmation count when refreshing an unchanged fact", async () => {
    // GIVEN the fact was confirmed twice in the web app, which counts confirmations on the fact itself
    const [fact] = await activeFacts();
    await db.update(facts).set({ evidence: { confirmations: 2 } }).where(eq(facts.id, fact.id));
    const withComment = place("yes", "store-test:node/1@v2");
    withComment.facts[0].evidence = { comment: "Wejście od podwórza" };
    // WHEN the next run brings the same value
    const changed = await store.applyPlace(meta, withComment, at(2));
    // THEN the source's evidence is refreshed and the count survives, so the fact stays community-confirmed
    expect(changed).toBe(0);
    const [refreshed] = await activeFacts();
    expect(refreshed.evidence).toEqual({ comment: "Wejście od podwórza", confirmations: 2 });
    // WHEN a later run has no evidence at all THEN only the count is kept
    await store.applyPlace(meta, place("yes", "store-test:node/1@v2"), at(2));
    expect((await activeFacts())[0].evidence).toEqual({ confirmations: 2 });
  });

  it("supersedes a changed value instead of overwriting it", async () => {
    // GIVEN the value changed at the source
    const changed = await store.applyPlace(meta, place("no", "store-test:node/1@v3"), at(3));
    // THEN the old fact is superseded and a new active one inserted
    expect(changed).toBe(1);
    const [p] = await db.select().from(places).where(eq(places.externalRef, "store-test:node/1"));
    const all = await db.select().from(facts).where(eq(facts.placeId, p.id));
    expect(all.map((f) => f.status).sort()).toEqual(["active", "superseded"]);
    expect((await activeFacts())[0].value).toEqual({ kind: "text", text: "no" });
  });

  it("supersedes a fact whose tag disappeared, and never deletes", async () => {
    // GIVEN the record no longer carries the attribute
    const changed = await store.applyPlace(meta, place("no", "store-test:node/1@v4", { facts: [] }), at(4));
    // THEN the active fact is superseded and history is kept
    expect(changed).toBe(1);
    expect(await activeFacts()).toHaveLength(0);
    const [p] = await db.select().from(places).where(eq(places.externalRef, "store-test:node/1"));
    expect((await db.select().from(facts).where(eq(facts.placeId, p.id))).length).toBe(2);
  });

  it("attaches a record from another source to an existing nearby place of the same name", async () => {
    // GIVEN the same venue arriving with a different external ref, 5 m away
    const other: MappedPlace = place("yes", "other:node/2", {
      externalRef: "other:node/2",
      name: "testowa kawiarnia",
      location: { x: 19.94004, y: 50.05 },
    });
    await store.applyPlace(meta, other, at(5));
    // THEN no second place is created
    const rows = await db.select().from(places).where(eq(places.name, "Testowa Kawiarnia"));
    expect(rows).toHaveLength(1);
    expect(await db.select().from(places).where(eq(places.externalRef, "other:node/2"))).toHaveLength(0);
  });

  it("attaches a record to the place it names in `sameAs`, whatever its name and distance", async () => {
    // GIVEN a page about the venue under another name, 500 m off, pointing at its OSM element
    const described: MappedPlace = place("yes", "page:doc/7@2026-03-19", {
      externalRef: "page:doc/7",
      name: "Kawiarnia przy Rynku – siedziba",
      location: { x: 19.947, y: 50.05 },
      sameAs: "store-test:node/1",
    });
    // WHEN applying it
    await store.applyPlace(meta, described, at(5));
    // THEN its fact lands on that place and no new place is created
    expect(await db.select().from(places).where(eq(places.externalRef, "page:doc/7"))).toHaveLength(0);
    expect((await activeFacts()).map((f) => f.sourceRecordRef)).toContain("page:doc/7@2026-03-19");
    await db.delete(facts).where(eq(facts.sourceRecordRef, "page:doc/7@2026-03-19"));
  });

  it("keeps two OSM elements of the same source apart even when they are close", async () => {
    // GIVEN a second OSM element 5 m away with the same name and category
    const twin: MappedPlace = place("no", "store-test:node/9", {
      externalRef: "store-test:node/9",
      location: { x: 19.94004, y: 50.05 },
    });
    // WHEN applying it
    await store.applyPlace(meta, twin, at(5));
    // THEN it is its own place, not merged into node/1
    expect(await db.select().from(places).where(eq(places.externalRef, "store-test:node/9"))).toHaveLength(1);
    await db.delete(facts).where(eq(facts.sourceRecordRef, "store-test:node/9"));
    await db.delete(places).where(eq(places.externalRef, "store-test:node/9"));
  });

  it("updates name and location of a place it owns", async () => {
    // GIVEN the place was renamed and moved in OSM
    await store.applyPlace(meta, place("yes", "store-test:node/1@v5", { name: "Nowa Nazwa", location: { x: 19.9401, y: 50.0501 } }), at(5));
    // THEN the stored place follows
    const [p] = await db.select().from(places).where(eq(places.externalRef, "store-test:node/1"));
    expect(p.name).toBe("Nowa Nazwa");
    expect(p.location.x).toBeCloseTo(19.9401);
  });

  it("marks a failing source as outage and records the error, keeping its facts", async () => {
    // GIVEN a source that succeeded once and then fails
    await store.markSource(meta.id, { ok: true }, at(1));
    await store.markSource(meta.id, { ok: false, error: "Overpass responded 504" }, at(2));
    // THEN it is in outage, with the last success preserved
    const [s] = await db.select().from(sources).where(eq(sources.id, meta.id));
    expect(s).toMatchObject({ refreshStatus: "outage", statusNote: "Overpass responded 504", lastSuccessAt: at(1) });
  });

  it("refreshes an unchanged fact read from an extract in place and notes the extract on the source", async () => {
    // GIVEN a fact stored from the live API and the same value read later from an extract
    await store.applyPlace(meta, place("yes", "store-test:node/1@v3"), at(3));
    const changed = await store.applyPlace(meta, place("yes", "store-test:node/1@v3;geofabrik-2026-10-02"), at(4));
    await store.markSource(meta.id, { ok: true, note: "OSM (Geofabrik, ekstrakt z 2026-10-02)" }, at(4));
    // THEN no new fact is inserted, the record ref names the extract and the source carries the note
    expect(changed).toBe(0);
    const rows = await activeFacts();
    const own = rows.filter((r) => r.sourceRecordRef.startsWith("store-test:node/1@"));
    expect(own.map((r) => r.sourceRecordRef)).toEqual(["store-test:node/1@v3;geofabrik-2026-10-02"]);
    const [s] = await db.select().from(sources).where(eq(sources.id, meta.id));
    expect(s).toMatchObject({ refreshStatus: "ok", statusNote: "OSM (Geofabrik, ekstrakt z 2026-10-02)", lastSuccessAt: at(4) });
    // AND a later run from the live API clears the note
    await store.markSource(meta.id, { ok: true }, at(5));
    const [after] = await db.select().from(sources).where(eq(sources.id, meta.id));
    expect(after.statusNote).toBeNull();
  });

  it("keeps every active fact when the adapter fails or the outage is simulated", async () => {
    // GIVEN a source with stored facts
    await store.applyPlace(meta, place("yes", "store-test:node/1@v3"), at(3));
    await store.markSource(meta.id, { ok: true }, at(3));
    const before = await activeFacts();
    expect(before.length).toBeGreaterThan(0);
    const broken = {
      meta,
      fetch: async () => Promise.reject(new Error("HTTP 404")),
      map: () => ({ place: null, skipped: [] }),
    };
    const base = { adapter: broken, city: krakow, store, userAgent: "test", retry: { attempts: 2, baseDelayMs: 0 } };

    // WHEN the adapter fails, and again with the outage simulated
    const failed = await runIngest(base);
    const simulated = await runIngest({ ...base, simulateOutage: [meta.id] });

    // THEN both runs are failed, the facts are untouched and the source is in outage with its last success kept
    expect(failed.status).toBe("failed");
    expect(simulated.status).toBe("failed");
    expect(await activeFacts()).toEqual(before);
    const [s] = await db.select().from(sources).where(eq(sources.id, meta.id));
    expect(s).toMatchObject({ refreshStatus: "outage", lastSuccessAt: at(3) });
  });
});
