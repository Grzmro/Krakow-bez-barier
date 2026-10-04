// Runs only against a migrated database: TEST_DATABASE_URL=postgres://… npx vitest run source-outages/drizzle-store
import { createDb, sourceOutageSimulations, sources } from "@krakow-bez-barier/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDrizzleSourceOutagesStore } from "./drizzle-store";
import { currentSimulatedOutageIds, listSimulations, startSimulation, stopSimulation } from "./service";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("Drizzle source outage simulations store (database)", () => {
  const handle = url ? createDb(url) : undefined;
  const sourceId = `test-${randomUUID()}`;
  afterAll(async () => {
    if (handle) {
      await handle.db.delete(sourceOutageSimulations).where(eq(sourceOutageSimulations.sourceId, sourceId));
      await handle.db.delete(sources).where(eq(sources.id, sourceId));
    }
    await handle?.close();
  });

  it("starts, restarts (one row), lists and stops a simulation, keeping the row as the audit", async () => {
    // GIVEN a fetched source
    const { db } = handle!;
    await db.insert(sources).values({ id: sourceId, name: "Test source", kind: "official_open_data", license: "CC0", baseReliability: "confirmed" });
    const store = createDrizzleSourceOutagesStore(db);
    const t0 = new Date();
    const anna = { name: "anna", demo: false };

    // WHEN it is switched on twice at once, then a minute later again
    await Promise.all([startSimulation(store, sourceId, anna, t0), startSimulation(store, sourceId, anna, t0)]);
    const later = new Date(t0.getTime() + 60_000);
    const restarted = await startSimulation(store, sourceId, anna, later);

    // THEN one simulation runs until 15 minutes after the last switch and the source counts as in outage
    expect(restarted).toMatchObject({ sourceId, sourceName: "Test source", startedBy: "anna", stoppedAt: null });
    expect(Date.parse(restarted.endsAt)).toBe(later.getTime() + 15 * 60_000);
    expect((await listSimulations(store, later)).filter((s) => s.sourceId === sourceId)).toHaveLength(1);
    expect(await currentSimulatedOutageIds(() => store, later, [], true)).toContain(sourceId);

    // WHEN it is switched off
    const stopped = await stopSimulation(store, sourceId, { name: "Konto demonstracyjne", demo: true }, later);

    // THEN it no longer runs and its row stays with who stopped it
    expect(stopped.stoppedAt).toBe(later.toISOString());
    expect(await currentSimulatedOutageIds(() => store, later, [], true)).not.toContain(sourceId);
    const rows = await db.select().from(sourceOutageSimulations).where(eq(sourceOutageSimulations.sourceId, sourceId));
    expect(rows).toEqual([expect.objectContaining({ startedBy: "anna", stoppedBy: "Konto demonstracyjne" })]);
  });
});
