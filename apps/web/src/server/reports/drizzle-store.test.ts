// Runs only against a migrated database: TEST_DATABASE_URL=postgres://… npx vitest run drizzle-store
import { createDb, facts, places, sources } from "@krakow-bez-barier/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { DEMO_MODERATED_SOURCE, DEMO_MODERATOR_NAME, DEMO_REVERT_MINUTES, revertExpiredDemoDecisions } from "./demo";
import { COMMUNITY_MODERATED_SOURCE, createDrizzleReportsStore } from "./drizzle-store";
import {
  createConfirmation,
  createReport,
  decideReport,
  listContributions,
  listModerationQueue,
  pendingReportsByAttribute,
  submitConfirmation,
  submitReport,
  withdrawContribution,
} from "./service";

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
    await decideReport(store, { reportId: report.id, decision: "needs_info", note: "?" }, { name: "anna", demo: false });
    const accepted = await decideReport(store, { reportId: report.id, decision: "accepted" }, { name: "anna", demo: false });

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

  it("accepts reports for one place and attribute at the same time", async () => {
    // GIVEN a place with several pending reports about its lift
    const { db } = handle!;
    const store = createDrizzleReportsStore(db);
    const ref = `test:${randomUUID()}`;
    const [place] = await db
      .insert(places)
      .values({ externalRef: ref, name: "Race place", category: "museum", location: { x: 19.94, y: 50.06 } })
      .returning();
    const pending = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        createReport(store, { placeId: ref, attribute: "lift", value: { kind: "boolean", boolean: i % 2 === 0 } }),
      ),
    );

    // WHEN moderators accept them all concurrently
    await Promise.all(pending.map((r, i) => decideReport(store, { reportId: r.id, decision: "accepted" }, { name: `mod${i}`, demo: false })));

    // THEN every decision succeeds and exactly one moderated fact stays active, the others superseded
    const all = await db.select().from(facts).where(eq(facts.placeId, place.id));
    expect(all.filter((f) => f.status === "active")).toHaveLength(1);
    expect(all.filter((f) => f.status === "superseded")).toHaveLength(5);
  });

  it("undoes the demo account's decisions, facts and confirmations after the revert time", async () => {
    // GIVEN a report a real moderator asked about
    const { db } = handle!;
    const store = createDrizzleReportsStore(db);
    const ref = `test:${randomUUID()}`;
    const [place] = await db
      .insert(places)
      .values({ externalRef: ref, name: "Demo place", category: "museum", location: { x: 19.94, y: 50.06 } })
      .returning();
    const report = await createReport(store, { placeId: ref, attribute: "lift", value: { kind: "boolean", boolean: false } });
    const asked = new Date(Date.now() - 60 * 60_000);
    await decideReport(store, { reportId: report.id, decision: "needs_info" }, { name: "anna", demo: false }, asked);

    // WHEN the demo account accepts it and someone confirms the demo fact
    await decideReport(store, { reportId: report.id, decision: "accepted" }, { name: DEMO_MODERATOR_NAME, demo: true });
    const [demoFact] = await db.select().from(facts).where(eq(facts.placeId, place.id));
    await createConfirmation(store, place.id, { factId: demoFact.id });

    // THEN the fact is from the demo source, not the real moderated one
    expect(demoFact).toMatchObject({ sourceId: DEMO_MODERATED_SOURCE.id, status: "active" });

    // WHEN the revert runs after the revert time
    const undone = await revertExpiredDemoDecisions(store, new Date(Date.now() + (DEMO_REVERT_MINUTES + 1) * 60_000));

    // THEN the report is back to the real moderator's decision and the demo fact is gone
    expect(undone).toBeGreaterThanOrEqual(1);
    const queue = await listModerationQueue(store, { status: "needs_info", limit: 100 });
    const item = queue.items.find((i) => i.id === report.id);
    expect(item?.history).toEqual([expect.objectContaining({ decision: "needs_info", moderator: "anna" })]);
    expect(item?.decidedAt).toBe(asked.toISOString());
    expect(await db.select().from(facts).where(eq(facts.placeId, place.id))).toEqual([]);
    expect((await pendingReportsByAttribute(store, place.id)).get("lift")).toHaveLength(1);
  });

  it("keeps one pending contribution per device, place and attribute, even when sent at once", async () => {
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
      .values({ externalRef: ref, name: "Device place", category: "museum", location: { x: 19.94, y: 50.06 } })
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
    const token = `device-${randomUUID()}`;
    const broken = { placeId: ref, attribute: "lift" as const, value: { kind: "boolean" as const, boolean: false } };

    // WHEN one device sends four lift reports at once
    const sent = await Promise.all(Array.from({ length: 4 }, () => submitReport(store, broken, token)));

    // THEN they are one report, updated in place
    expect(new Set(sent.map((s) => s.report.id)).size).toBe(1);
    expect((await pendingReportsByAttribute(store, place.id)).get("lift")).toHaveLength(1);

    // WHEN the device confirms the lift instead
    const confirmed = await submitConfirmation(store, place.id, { factId: lift.id }, { contributorToken: token });
    const again = await submitConfirmation(store, place.id, { factId: lift.id }, { contributorToken: token });

    // THEN the report is withdrawn (out of the queue), the confirmation counted once
    expect([confirmed.created, again.created]).toEqual([true, false]);
    expect((await pendingReportsByAttribute(store, place.id)).get("lift")).toBeUndefined();
    const queue = await listModerationQueue(store, { limit: 1000 });
    expect(queue.items.some((i) => i.id === sent[0].report.id)).toBe(false);
    expect(await listContributions(store, place.id, token)).toEqual([
      expect.objectContaining({ kind: "confirmation", factId: lift.id }),
    ]);

    // WHEN the device withdraws its lift contribution
    await withdrawContribution(store, place.id, "lift", token);

    // THEN nothing is pending for it and the fact counts no confirmations
    expect(await listContributions(store, place.id, token)).toEqual([]);
    const [after] = await db.select().from(facts).where(eq(facts.id, lift.id));
    expect(after.evidence?.confirmations).toBe(0);
  });
});
