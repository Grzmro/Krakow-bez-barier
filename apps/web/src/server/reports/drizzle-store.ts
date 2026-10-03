import type { AccessibilityFact } from "@krakow-bez-barier/contracts";
import { confirmations, facts, moderationLog, places, reports, sources, type Db } from "@krakow-bez-barier/db";
import { and, asc, desc, eq, gt, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db";
import { DEMO_MODERATED_SOURCE } from "./demo";
import type { ModerationEventRecord, QueueItem, ReportRecord, ReportsStore } from "./store";

/** The source every accepted report is attributed to (US-4.4). */
export const COMMUNITY_MODERATED_SOURCE = {
  id: "community-moderated",
  name: "Społeczność, zweryfikowane przez moderatora",
  kind: "user_report",
  license: "Not open data: user reports verified by a moderator (docs/data-sources.md)",
  attribution: "Użytkownicy Kraków bez barier",
  refreshInterval: "continuous",
  baseReliability: "confirmed",
  refreshStatus: "ok",
} satisfies typeof sources.$inferInsert;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string) => UUID.test(value);

type ReportRow = typeof reports.$inferSelect;

const toRecord = (row: ReportRow): ReportRecord => ({
  id: row.id,
  placeId: row.placeId,
  attribute: row.attribute,
  value: row.value,
  comment: row.comment,
  photoUrl: row.photoUrl,
  status: row.status,
  createdAt: row.createdAt,
  decidedAt: row.decidedAt,
});

type FactWithSource = { fact: typeof facts.$inferSelect; source: typeof sources.$inferSelect };

function toFact({ fact, source }: FactWithSource): AccessibilityFact {
  return {
    id: fact.id,
    attribute: fact.attribute,
    value: fact.value,
    unit: fact.unit,
    source: { id: source.id, name: source.name, kind: source.kind, recordRef: fact.sourceRecordRef || null },
    fetchedAt: fact.fetchedAt.toISOString(),
    observedAt: fact.observedAt?.toISOString() ?? null,
    confirmedAt: fact.confirmedAt?.toISOString() ?? null,
    reliability: fact.reliability,
    evidence: fact.evidence
      ? {
          photoUrl: fact.evidence.photoUrl ?? null,
          comment: fact.evidence.comment ?? null,
          ...(fact.evidence.confirmations !== undefined && { confirmations: fact.evidence.confirmations }),
        }
      : null,
    status: fact.status,
    stale: source.refreshStatus === "stale" || source.refreshStatus === "outage",
  };
}

export function createDrizzleReportsStore(db: Db): ReportsStore {
  return {
    async findPlace(ref) {
      const [place] = await db
        .select({ id: places.id, name: places.name })
        .from(places)
        .where(isUuid(ref) ? eq(places.id, ref) : eq(places.externalRef, ref))
        .limit(1);
      return place ?? null;
    },

    async insertReport(report) {
      const [row] = await db.insert(reports).values(report).returning();
      return toRecord(row);
    },

    async findActiveFact(placeId, factId) {
      if (!isUuid(factId)) return null;
      const [fact] = await db
        .select({ id: facts.id })
        .from(facts)
        .where(and(eq(facts.id, factId), eq(facts.placeId, placeId), eq(facts.status, "active")))
        .limit(1);
      return fact ?? null;
    },

    async confirmFact({ placeId, factId, comment, at }) {
      return db.transaction(async (tx) => {
        const [row] = await tx.insert(confirmations).values({ placeId, factId, comment, createdAt: at }).returning();
        await tx
          .update(facts)
          .set({
            confirmedAt: at,
            evidence: sql`coalesce(${facts.evidence}, '{}'::jsonb) || jsonb_build_object('confirmations',
              (select count(*)::int from ${confirmations} where ${confirmations.factId} = ${factId}))`,
          })
          .where(eq(facts.id, factId));
        return row;
      });
    },

    async listQueue({ status, limit, after }) {
      const conditions: (SQL | undefined)[] = [status && eq(reports.status, status)];
      if (after) {
        conditions.push(
          or(
            gt(reports.createdAt, after.createdAt),
            and(eq(reports.createdAt, after.createdAt), gt(reports.id, after.id)),
          ),
        );
      }
      const rows = await db
        .select({ report: reports, placeName: places.name })
        .from(reports)
        .innerJoin(places, eq(places.id, reports.placeId))
        .where(and(...conditions))
        .orderBy(asc(reports.createdAt), asc(reports.id))
        .limit(limit);
      if (rows.length === 0) return [];

      const reportIds = rows.map((r) => r.report.id);
      const placeIds = [...new Set(rows.map((r) => r.report.placeId))];
      const [logs, current] = await Promise.all([
        db
          .select()
          .from(moderationLog)
          .where(inArray(moderationLog.reportId, reportIds))
          .orderBy(asc(moderationLog.createdAt), asc(moderationLog.id)),
        db
          .select({ fact: facts, source: sources })
          .from(facts)
          .innerJoin(sources, eq(sources.id, facts.sourceId))
          .where(and(inArray(facts.placeId, placeIds), eq(facts.status, "active"))),
      ]);

      return rows.map(({ report, placeName }): QueueItem => ({
        report: toRecord(report),
        placeName,
        currentFacts: current
          .filter(({ fact }) => fact.placeId === report.placeId && fact.attribute === report.attribute)
          .map(toFact),
        history: logs
          .filter((log) => log.reportId === report.id)
          .map(
            (log): ModerationEventRecord => ({
              decision: log.decision,
              note: log.note,
              moderator: log.moderator,
              createdAt: log.createdAt,
            }),
          ),
      }));
    },

    async decide({ reportId, decision, note, moderator, demo, at, toFact: buildFact }) {
      if (!isUuid(reportId)) return { kind: "not_found" };
      return db.transaction(async (tx) => {
        const [current] = await tx.select().from(reports).where(eq(reports.id, reportId)).for("update");
        if (!current) return { kind: "not_found" } as const;
        if (current.status === "accepted" || current.status === "rejected") {
          return { kind: "final", status: current.status } as const;
        }

        const [updated] = await tx
          .update(reports)
          .set({ status: decision, decidedAt: at })
          .where(eq(reports.id, reportId))
          .returning();
        await tx.insert(moderationLog).values({ reportId, decision, note, moderator, createdAt: at });

        if (decision === "accepted") {
          const fact = buildFact(toRecord(updated));
          const source = demo ? DEMO_MODERATED_SOURCE : COMMUNITY_MODERATED_SOURCE;
          await tx.insert(sources).values(source).onConflictDoNothing();
          // Two reports for one place and attribute accepted at once would both insert an active fact and break the
          // unique index; this serialises them so the second supersedes the first.
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`${source.id}|${fact.sourceRecordRef}|${fact.attribute}`}))`,
          );
          // Facts are never overwritten: the source's earlier fact for this place and attribute is superseded.
          await tx
            .update(facts)
            .set({ status: "superseded", supersededAt: at })
            .where(
              and(
                eq(facts.sourceId, source.id),
                eq(facts.sourceRecordRef, fact.sourceRecordRef),
                eq(facts.subject, "place"),
                eq(facts.attribute, fact.attribute),
                eq(facts.status, "active"),
              ),
            );
          await tx.insert(facts).values({
            placeId: fact.placeId,
            subject: "place",
            attribute: fact.attribute,
            value: fact.value,
            unit: fact.unit,
            sourceId: source.id,
            sourceRecordRef: fact.sourceRecordRef,
            fetchedAt: fact.fetchedAt,
            observedAt: fact.observedAt,
            confirmedAt: fact.confirmedAt,
            reliability: source.baseReliability,
            evidence: { comment: fact.comment, photoUrl: fact.photoUrl },
          });
        }
        return { kind: "decided", report: toRecord(updated) } as const;
      });
    },

    async listPending(placeId) {
      const rows = await db
        .select()
        .from(reports)
        .where(and(eq(reports.placeId, placeId), inArray(reports.status, ["new", "needs_info"])))
        .orderBy(asc(reports.createdAt), asc(reports.id));
      return rows.map(toRecord);
    },

    async revertDemoDecisions({ moderator, before }) {
      return db.transaction(async (tx) => {
        const undone = await tx
          .delete(moderationLog)
          .where(and(eq(moderationLog.moderator, moderator), lt(moderationLog.createdAt, before)))
          .returning({ reportId: moderationLog.reportId });
        for (const reportId of new Set(undone.map((u) => u.reportId))) {
          await tx.select({ id: reports.id }).from(reports).where(eq(reports.id, reportId)).for("update");
          const [latest] = await tx
            .select()
            .from(moderationLog)
            .where(eq(moderationLog.reportId, reportId))
            .orderBy(desc(moderationLog.createdAt), desc(moderationLog.id))
            .limit(1);
          await tx
            .update(reports)
            .set({ status: latest?.decision ?? "new", decidedAt: latest?.createdAt ?? null })
            .where(eq(reports.id, reportId));
        }

        const expired = tx
          .select({ id: facts.id })
          .from(facts)
          .where(and(eq(facts.sourceId, DEMO_MODERATED_SOURCE.id), lt(facts.fetchedAt, before)));
        await tx.delete(confirmations).where(inArray(confirmations.factId, expired));
        await tx.delete(facts).where(and(eq(facts.sourceId, DEMO_MODERATED_SOURCE.id), lt(facts.fetchedAt, before)));
        // The demo source exists only while it has facts, so the source list doesn't keep it for good.
        await tx
          .delete(sources)
          .where(
            and(
              eq(sources.id, DEMO_MODERATED_SOURCE.id),
              sql`not exists (select 1 from ${facts} where ${facts.sourceId} = ${DEMO_MODERATED_SOURCE.id})`,
            ),
          );
        return undone.length;
      });
    },
  };
}

/** The store the route handlers use, over the shared database client. */
export function reportsStore(): ReportsStore {
  return createDrizzleReportsStore(getDb());
}
