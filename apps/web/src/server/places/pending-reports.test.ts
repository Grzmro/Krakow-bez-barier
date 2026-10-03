// Runs only against a migrated database: TEST_DATABASE_URL=postgres://… npx vitest run pending-reports
import { createDb, places } from "@krakow-bez-barier/db";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDrizzleReportsStore } from "@/server/reports";
import { createReport, decideReport } from "@/server/reports/service";
import { createDbPlaceRepository } from "./repository";
import { getPlace, withPendingReports } from "./service";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("place card with pending reports (database)", () => {
  const handle = url ? createDb(url) : undefined;
  afterAll(() => handle?.close());

  it("shows a report as pending until a moderator rejects or accepts it", async () => {
    // GIVEN a place without facts and two reports that it has a lift
    const { db } = handle!;
    const store = createDrizzleReportsStore(db);
    const repository = createDbPlaceRepository(db);
    const [place] = await db
      .insert(places)
      .values({ externalRef: `test:${randomUUID()}`, name: "Test place", category: "museum", location: { x: 19.94, y: 50.06 } })
      .returning();
    const lift = { kind: "boolean" as const, boolean: true };
    const rejected = await createReport(store, { placeId: place.id, attribute: "lift", value: lift });
    const accepted = await createReport(store, { placeId: place.id, attribute: "lift", value: lift, comment: "winda od podwórza" });
    const read = async () => {
      const card = await withPendingReports((await getPlace(place.id, {}, { repository }))!, store);
      return card.attributes.find((a) => a.attribute === "lift")!;
    };

    // WHEN the card is read
    // THEN both reports sit beside a still unknown lift
    const pending = await read();
    expect(pending).toMatchObject({ state: "unknown", facts: [] });
    expect(pending.pendingReports?.map((r) => r.id)).toEqual([rejected.id, accepted.id]);

    // WHEN a moderator rejects one
    await decideReport(store, { reportId: rejected.id, decision: "rejected" }, "anna");

    // THEN it no longer shows on the card
    expect((await read()).pendingReports?.map((r) => r.id)).toEqual([accepted.id]);

    // WHEN the moderator accepts the other
    await decideReport(store, { reportId: accepted.id, decision: "accepted" }, "anna");

    // THEN the card shows it as a moderated community fact, not as a pending report
    const known = await read();
    expect(known.pendingReports).toEqual([]);
    expect(known).toMatchObject({ state: "known", value: lift });
    expect(known.facts.map((f) => [f.source.name, f.reliability])).toEqual([
      ["Społeczność, zweryfikowane przez moderatora", "confirmed"],
    ]);
  });
});
