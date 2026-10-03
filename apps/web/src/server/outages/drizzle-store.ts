import type { OutageEquipment } from "@krakow-bez-barier/contracts";
import { outages, outageVotes, places, type Db } from "@krakow-bez-barier/db";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { OutageRecord } from "@/domain/outages";
import { getDb } from "@/server/db";
import type { OutagesStore } from "./store";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string) => UUID.test(value);

const STILL_BROKEN = sql`${outageVotes.vote} = 'still_broken'`;
const lastConfirmedAt = sql<string>`greatest(${outages.createdAt}, max(${outageVotes.createdAt}) filter (where ${STILL_BROKEN}))`;

/** Outages matching `where` with their votes counted, newest first; `since` keeps those confirmed at or after it. */
async function selectRecords(db: Db | Tx, where: SQL | undefined, since?: Date): Promise<OutageRecord[]> {
  const rows = await db
    .select({
      id: outages.id,
      placeId: outages.placeId,
      equipment: outages.equipment,
      reportedAt: outages.createdAt,
      confirmations: sql<number>`count(${outageVotes.id}) filter (where ${STILL_BROKEN})`,
      workingVotes: sql<number>`count(${outageVotes.id}) filter (where ${outageVotes.vote} = 'working')`,
      lastConfirmedAt,
    })
    .from(outages)
    .leftJoin(outageVotes, eq(outageVotes.outageId, outages.id))
    .where(where)
    .groupBy(outages.id)
    .having(since ? sql`${lastConfirmedAt} >= ${since.toISOString()}` : undefined)
    .orderBy(desc(outages.createdAt), desc(outages.id));
  return rows.map((row) => ({
    ...row,
    confirmations: Number(row.confirmations),
    workingVotes: Number(row.workingVotes),
    lastConfirmedAt: new Date(row.lastConfirmedAt),
  }));
}

// Serialises reports and votes of one place's equipment, so two reports at once open one outage, not two.
const lock = (tx: Tx, placeId: string, equipment: OutageEquipment) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`outages|${placeId}|${equipment}`}))`);

async function latest(tx: Tx, placeId: string, equipment: OutageEquipment) {
  const [record] = await selectRecords(tx, and(eq(outages.placeId, placeId), eq(outages.equipment, equipment)));
  return record;
}

async function byId(tx: Tx, id: string) {
  const [record] = await selectRecords(tx, eq(outages.id, id));
  return record;
}

export function createDrizzleOutagesStore(db: Db): OutagesStore {
  return {
    async findPlace(ref) {
      const [place] = await db
        .select({ id: places.id })
        .from(places)
        .where(isUuid(ref) ? eq(places.id, ref) : eq(places.externalRef, ref))
        .limit(1);
      return place ?? null;
    },

    async report({ placeId, equipment, at, isActive, mayConfirm }) {
      return db.transaction(async (tx) => {
        await lock(tx, placeId, equipment);
        const current = await latest(tx, placeId, equipment);
        if (current && isActive(current)) {
          if (!mayConfirm(current.id)) return { record: current, created: false, confirmed: false };
          await tx.insert(outageVotes).values({ outageId: current.id, vote: "still_broken", createdAt: at });
          return { record: await byId(tx, current.id), created: false, confirmed: true };
        }
        const [row] = await tx.insert(outages).values({ placeId, equipment, createdAt: at }).returning({ id: outages.id });
        return { record: await byId(tx, row.id), created: true, confirmed: false };
      });
    },

    async vote({ placeId, outageId, vote, at, isActive }) {
      if (!isUuid(outageId)) return { kind: "not_found" };
      return db.transaction(async (tx) => {
        const [outage] = await tx
          .select({ equipment: outages.equipment })
          .from(outages)
          .where(and(eq(outages.id, outageId), eq(outages.placeId, placeId)));
        if (!outage) return { kind: "not_found" } as const;
        await lock(tx, placeId, outage.equipment);
        const current = await byId(tx, outageId);
        if (!isActive(current)) return { kind: "inactive", record: current } as const;
        await tx.insert(outageVotes).values({ outageId, vote, createdAt: at });
        return { kind: "voted", record: await byId(tx, outageId) } as const;
      });
    },

    async listRecent(placeIds, since) {
      if (placeIds.length === 0) return [];
      return selectRecords(db, inArray(outages.placeId, placeIds), since);
    },
  };
}

/** The store the route handlers use, over the shared database client. */
export function outagesStore(): OutagesStore {
  return createDrizzleOutagesStore(getDb());
}
