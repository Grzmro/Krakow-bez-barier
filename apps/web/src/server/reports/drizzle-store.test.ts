// Runs only against a migrated database: TEST_DATABASE_URL=postgres://… npx vitest run drizzle-store
import { createDb, facts, places, sources } from "@krakow-bez-barier/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { COMMUNITY_MODERATED_SOURCE, createDrizzleReportsStore } from "./drizzle-store";
import { createConfirmation, createReport, decideReport, listModerationQueue, pendingReportsByAttribute } from "./service";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("Drizzle reports store (database)", () => {
  const handle = url ? createDb(url) : undefined;
  afterAll(() => handle?.close());

  it("runs report → confirmations → moderation end to end", async () => {
    // GIVEN a place with an OpenStreetMap lift fact
    const { db } = handle!;
    const store = createDrizzleReportsStore(db);
    await db
      .insert(sources)
      .values({ id: "osm", name: "OpenStreetMap", kind: "community", license: "ODbL 1.0", baseReliability: "community" })
      .onConflictDoNothing();
    const ref = `test:${randomUUID()}`;
    const [place] = await db
      .insert(places)
      .values({ externalRef: ref, name: "Test place", category: "museum", location: { x: 19.94, y: 50.06 } })
      .returning();
    const [lift] = await db
      .insert(facts)
      .values({
        placeId: place.id,
        attribute: "lift",
        value: { kind: "boolean", boolean: true },
        sourceId: "osm",
        sourceRecordRef: ref,
        fetchedAt: new Date(),
        reliability: "community",
      })
      .returning();

    // WHEN a report is filed and the fact is confirmed twice
    const report = await createReport(store, { placeId: ref, attribute: "lift", value: { kind: "boolean", boolean: false } });
    await createConfirmation(store, place.id, { factId: lift.id });
    await createConfirmation(store, place.id, { factId: lift.id });

    // THEN the report is pending and the fact carries two confirmations
    expect((await pendingReportsByAttribute(store, place.id)).get("lift")).toHaveLength(1);
    const [confirmed] = await db.select().from(facts).where(eq(facts.id, lift.id));
    expect(confirmed.evidence?.confirmations).toBe(2);
    expect(confirmed.confirmedAt).not.toBeNull();

    // WHEN a moderator asks for details, then accepts
    await decideReport(store, { reportId: report.id, decision: "needs_info", note: "?" }, "anna");
    const accepted = await decideReport(store, { reportId: report.id, decision: "accepted" }, "anna");

    // THEN the queue shows the history and the place gets a moderated community fact beside OSM's
    const queue = await listModerationQueue(store, { status: "accepted", limit: 100 });
    const item = queue.items.find((i) => i.id === report.id);
    expect(item?.history.map((h) => h.decision)).toEqual(["needs_info", "accepted"]);
    const all = await db.select().from(facts).where(eq(facts.placeId, place.id));
    const community = all.find((f) => f.sourceId === COMMUNITY_MODERATED_SOURCE.id);
    expect(community).toMatchObject({ reliability: "confirmed", status: "active" });
    expect(community?.confirmedAt?.toISOString()).toBe(accepted.decidedAt);
    // OSM still says the lift works, so the card shows a conflict rather than one value.
    expect(item?.currentValue).toBeNull();
  });
});
