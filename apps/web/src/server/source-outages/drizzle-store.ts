import { sourceOutageSimulations, sources, type Db } from "@krakow-bez-barier/db";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import type { SimulationRecord, SourceOutagesStore } from "./store";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const running = (now: Date) => and(isNull(sourceOutageSimulations.stoppedAt), gt(sourceOutageSimulations.endsAt, now));

async function select(db: Db | Tx, where: ReturnType<typeof running>): Promise<(SimulationRecord & { id: string })[]> {
  return db
    .select({
      id: sourceOutageSimulations.id,
      sourceId: sourceOutageSimulations.sourceId,
      sourceName: sources.name,
      startedBy: sourceOutageSimulations.startedBy,
      startedAt: sourceOutageSimulations.startedAt,
      endsAt: sourceOutageSimulations.endsAt,
      stoppedAt: sourceOutageSimulations.stoppedAt,
    })
    .from(sourceOutageSimulations)
    .innerJoin(sources, eq(sources.id, sourceOutageSimulations.sourceId))
    .where(where)
    .orderBy(desc(sourceOutageSimulations.startedAt));
}

// Serialises switches of one source, so two clicks at once restart one simulation instead of opening two.
const lock = (tx: Tx, sourceId: string) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`source-outage-simulation|${sourceId}`}))`);

const strip = (row: SimulationRecord & { id: string }): SimulationRecord => ({
  sourceId: row.sourceId,
  sourceName: row.sourceName,
  startedBy: row.startedBy,
  startedAt: row.startedAt,
  endsAt: row.endsAt,
  stoppedAt: row.stoppedAt,
});

export function createDrizzleSourceOutagesStore(db: Db): SourceOutagesStore {
  return {
    async findSource(id) {
      const [source] = await db
        .select({ id: sources.id, name: sources.name, kind: sources.kind })
        .from(sources)
        .where(eq(sources.id, id))
        .limit(1);
      return source ?? null;
    },

    async listRunning(now) {
      return (await select(db, running(now))).map(strip);
    },

    async start({ sourceId, moderator, at, endsAt }) {
      return db.transaction(async (tx) => {
        await lock(tx, sourceId);
        const [current] = await select(tx, and(eq(sourceOutageSimulations.sourceId, sourceId), running(at)));
        if (current) {
          await tx.update(sourceOutageSimulations).set({ endsAt }).where(eq(sourceOutageSimulations.id, current.id));
          return strip({ ...current, endsAt });
        }
        const [row] = await tx
          .insert(sourceOutageSimulations)
          .values({ sourceId, startedBy: moderator, startedAt: at, endsAt })
          .returning({ id: sourceOutageSimulations.id });
        const [created] = await select(tx, eq(sourceOutageSimulations.id, row.id));
        return strip(created);
      });
    },

    async stop({ sourceId, moderator, at }) {
      return db.transaction(async (tx) => {
        await lock(tx, sourceId);
        const stopped = await select(tx, and(eq(sourceOutageSimulations.sourceId, sourceId), running(at)));
        if (!stopped.length) return null;
        await tx
          .update(sourceOutageSimulations)
          .set({ stoppedAt: at, stoppedBy: moderator })
          .where(and(eq(sourceOutageSimulations.sourceId, sourceId), running(at)));
        return strip({ ...stopped[0], stoppedAt: at });
      });
    },
  };
}

/** The store the route handlers use, over the shared database client. */
export function sourceOutagesStore(): SourceOutagesStore {
  return createDrizzleSourceOutagesStore(getDb());
}
