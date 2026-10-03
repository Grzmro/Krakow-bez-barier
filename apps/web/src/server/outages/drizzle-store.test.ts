// Runs only against a migrated database: TEST_DATABASE_URL=postgres://… npx vitest run outages/drizzle-store
import { createDb, outages, outageVotes, places } from "@krakow-bez-barier/db";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDbPlaceRepository } from "@/server/places/repository";
import { getPlace } from "@/server/places/service";
import { createDrizzleOutagesStore } from "./drizzle-store";
import { listModerationOutages, removeOutage, reportOutage, voteOutage } from "./service";

const url = process.env.TEST_DATABASE_URL;
const HOUR = 3_600_000;

describe.skipIf(!url)("Drizzle outages store (database)", () => {
  const handle = url ? createDb(url) : undefined;
  const placeIds: string[] = [];
  afterAll(async () => {
    if (handle && placeIds.length) {
      const { db } = handle;
      const created = db.select({ id: outages.id }).from(outages).where(inArray(outages.placeId, placeIds));
      await db.delete(outageVotes).where(inArray(outageVotes.outageId, created));
      await db.delete(outages).where(inArray(outages.placeId, placeIds));
      await db.delete(places).where(inArray(places.id, placeIds));
    }
    await handle?.close();
  });

  async function newPlace() {
    const [place] = await handle!.db
      .insert(places)
      .values({ externalRef: `test:${randomUUID()}`, name: "Test place", category: "museum", location: { x: 19.94, y: 50.06 } })
      .returning();
    placeIds.push(place.id);
    return place;
  }

  it("runs report → confirmations → working, and the card lists the outage only while it is active", async () => {
    // GIVEN a place without outages
    const { db } = handle!;
    const store = createDrizzleOutagesStore(db);
    const repository = createDbPlaceRepository(db);
    const place = await newPlace();
    const card = async () => (await getPlace(place.id, { profile: "wheelchair" }, { repository }))!;

    // WHEN its lift is reported, then reported again and confirmed by two more visitors (at once)
    const opened = await reportOutage(store, place.externalRef!, { equipment: "lift" });
    const [again, confirm] = await Promise.all([
      reportOutage(store, place.id, { equipment: "lift" }),
      voteOutage(store, place.id, opened.outage.id, { vote: "still_broken" }),
    ]);

    // THEN one outage collects both confirmations and is confirmed by the community
    expect(opened).toMatchObject({ created: true, outage: { state: "reported", confirmations: 0 } });
    expect(again).toMatchObject({ created: false, confirmed: true, outage: { id: opened.outage.id } });
    expect(confirm.id).toBe(opened.outage.id);
    const listed = await card();
    expect(listed.outages).toEqual([expect.objectContaining({ id: opened.outage.id, state: "confirmed", confirmations: 2 })]);
    expect(listed.verdict?.needs?.find((n) => n.need === "lift")).toMatchObject({ state: "barrier", outage: true, unconfirmed: false });

    // WHEN someone says it works
    const fixed = await voteOutage(store, place.id, opened.outage.id, { vote: "working" });

    // THEN it is resolved, off the card, and a new report opens a fresh outage
    expect(fixed.state).toBe("resolved");
    expect((await card()).outages).toEqual([]);
    expect(await reportOutage(store, place.id, { equipment: "lift" })).toMatchObject({ created: true });
  });

  it("takes a removed outage off the card and the moderator's list, keeping who removed it", async () => {
    // GIVEN a reported ramp outage
    const { db } = handle!;
    const store = createDrizzleOutagesStore(db);
    const place = await newPlace();
    const { outage } = await reportOutage(store, place.id, { equipment: "ramp" });
    expect((await listModerationOutages(store)).map((o) => o.id)).toContain(outage.id);

    // WHEN a moderator removes it, then tries again
    const removed = await removeOutage(store, outage.id, { name: "anna", demo: false });
    const again = removeOutage(store, outage.id, { name: "anna", demo: false });

    // THEN it is removed with the place name, off the card and the list, and the second removal is a 409
    expect(removed).toMatchObject({ state: "removed", placeName: "Test place" });
    await expect(again).rejects.toMatchObject({ problem: { status: 409 } });
    const read = await getPlace(place.id, {}, { repository: createDbPlaceRepository(db) });
    expect(read?.outages).toEqual([]);
    expect((await listModerationOutages(store)).map((o) => o.id)).not.toContain(outage.id);
    const [row] = await db.select().from(outages).where(eq(outages.id, outage.id));
    expect(row).toMatchObject({ removedBy: "anna", removalEndsAt: null });
  });

  it("expires an outage nobody confirms for 48 hours", async () => {
    // GIVEN a ramp outage reported 49 hours ago
    const { db } = handle!;
    const store = createDrizzleOutagesStore(db);
    const place = await newPlace();
    const then = new Date(Date.now() - 49 * HOUR);
    const { outage } = await reportOutage(store, place.id, { equipment: "ramp" }, { now: then });

    // WHEN the card is read now and someone tries to confirm it
    const read = await getPlace(place.id, {}, { repository: createDbPlaceRepository(db) });

    // THEN it is gone and the vote is refused as no longer active
    expect(read?.outages).toEqual([]);
    await expect(voteOutage(store, place.id, outage.id, { vote: "still_broken" })).rejects.toMatchObject({ problem: { status: 409 } });
  });
});
