import type { AccessibilityAttribute, AccessibilityFact, ReportStatus } from "@krakow-bez-barier/contracts";
import { confirmations, facts, moderationLog, places, reports, sources, type Db } from "@krakow-bez-barier/db";
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db";
import { isWithheld, withheldSourceIds } from "@/server/sources";
import { DEMO_MODERATED_SOURCE } from "./demo";
import type {
  ConfirmationRecord,
  ContributionRecord,
  ModerationEventRecord,
  QueueItem,
  ReportRecord,
  ReportsStore,
} from "./store";

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

    async saveContributorReport({ contributor, at, ...report }) {
      return db.transaction(async (tx) => {
        await lockContribution(tx, contributor, report.placeId, report.attribute);
        await withdrawConfirmations(tx, { contributor, placeId: report.placeId, attribute: report.attribute });
        const [pending] = await tx
          .select({ id: reports.id })
          .from(reports)
          .where(pendingOf(contributor, report.placeId, report.attribute))
          .limit(1)
          .for("update");
        if (pending) {
          const [row] = await tx
            .update(reports)
            .set({ value: report.value, comment: report.comment, createdAt: at })
            .where(eq(reports.id, pending.id))
            .returning();
          return { report: toRecord(row), replaced: true };
        }
        const [row] = await tx
          .insert(reports)
          .values({ ...report, contributorHash: contributor, createdAt: at })
          .returning();
        return { report: toRecord(row), replaced: false };
      });
    },

    async findActiveFact(placeId, factId) {
      if (!isUuid(factId)) return null;
      const [fact] = await db
        .select({ id: facts.id, attribute: facts.attribute })
        .from(facts)
        .where(and(eq(facts.id, factId), eq(facts.placeId, placeId), eq(facts.status, "active")))
        .limit(1);
      return fact ?? null;
    },

    async confirmFact({ placeId, factId, comment, at }) {
      return db.transaction((tx) => insertConfirmation(tx, { placeId, factId, comment, at, contributor: null }));
    },

    async confirmFactAsContributor({ placeId, factId, attribute, comment, at, contributor, admit }) {
      return db.transaction(async (tx) => {
        await lockContribution(tx, contributor, placeId, attribute);
        const [existing] = await tx
          .select()
          .from(confirmations)
          .where(and(eq(confirmations.contributorHash, contributor), eq(confirmations.factId, factId)))
          .limit(1);
        if (existing) return { confirmation: toConfirmation(existing), created: false };
        admit();
        await tx.update(reports).set({ withdrawnAt: at }).where(pendingOf(contributor, placeId, attribute));
        await withdrawConfirmations(tx, { contributor, placeId, attribute });
        const confirmation = await insertConfirmation(tx, { placeId, factId, comment, at, contributor });
        return { confirmation, created: true };
      });
    },

    async listContributions(placeId, contributor) {
      const [pending, confirmed] = await Promise.all([
        db
          .select()
          .from(reports)
          .where(and(eq(reports.contributorHash, contributor), eq(reports.placeId, placeId), isNull(reports.withdrawnAt), inArray(reports.status, PENDING)))
          .orderBy(asc(reports.createdAt)),
        db
          .select({ confirmation: confirmations, fact: facts })
          .from(confirmations)
          .innerJoin(facts, eq(facts.id, confirmations.factId))
          .where(
            and(eq(confirmations.contributorHash, contributor), eq(confirmations.placeId, placeId), eq(facts.status, "active")),
          )
          .orderBy(asc(confirmations.createdAt)),
      ]);
      return [
        ...pending.map((r): ContributionRecord => ({
          kind: "report",
          id: r.id,
          attribute: r.attribute,
          value: r.value,
          factId: null,
          createdAt: r.createdAt,
        })),
        ...confirmed.map(({ confirmation, fact }): ContributionRecord => ({
          kind: "confirmation",
          id: confirmation.id,
          attribute: fact.attribute,
          value: fact.value,
          factId: fact.id,
          createdAt: confirmation.createdAt,
        })),
      ];
    },

    async withdrawContributions({ placeId, attribute, contributor, at }) {
      await db.transaction(async (tx) => {
        await lockContribution(tx, contributor, placeId, attribute);
        await tx.update(reports).set({ withdrawnAt: at }).where(pendingOf(contributor, placeId, attribute));
        await withdrawConfirmations(tx, { contributor, placeId, attribute });
      });
    },

    async listQueue({ status, limit, after }) {
      const conditions: (SQL | undefined)[] = [status && eq(reports.status, status), isNull(reports.withdrawnAt)];
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

      const withheld = withheldSourceIds();
      return rows.map(({ report, placeName }): QueueItem => ({
        report: toRecord(report),
        placeName,
        currentFacts: current
          .filter(({ fact, source }) => fact.placeId === report.placeId && fact.attribute === report.attribute && !isWithheld(source, withheld))
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
        if (!current || current.withdrawnAt) return { kind: "not_found" } as const;
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
          // The revert drops the demo source row once it has no facts; this keeps it from doing so between the
          // upsert below and the fact insert, which would then break the facts → sources foreign key.
          if (demo) await tx.execute(sql`select pg_advisory_xact_lock_shared(hashtext(${DEMO_SOURCE_LOCK}))`);
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
        .where(and(eq(reports.placeId, placeId), inArray(reports.status, PENDING), isNull(reports.withdrawnAt)))
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
          const [report] = await tx.select().from(reports).where(eq(reports.id, reportId)).for("update");
          const [latest] = await tx
            .select()
            .from(moderationLog)
            .where(eq(moderationLog.reportId, reportId))
            .orderBy(desc(moderationLog.createdAt), desc(moderationLog.id))
            .limit(1);
          const status = latest?.decision ?? "new";
          // Back to pending while the same device has sent a newer report of the attribute: the newer one stays the
          // device's one pending contribution and this one counts as withdrawn (the unique index allows only one).
          const superseded =
            report?.contributorHash && !report.withdrawnAt && PENDING.includes(status)
              ? await tx
                  .select({ id: reports.id })
                  .from(reports)
                  .where(and(pendingOf(report.contributorHash, report.placeId, report.attribute), ne(reports.id, reportId)))
                  .limit(1)
              : [];
          await tx
            .update(reports)
            .set({
              status,
              decidedAt: latest?.createdAt ?? null,
              ...(superseded.length > 0 && { withdrawnAt: before }),
            })
            .where(eq(reports.id, reportId));
        }

        const expired = tx
          .select({ id: facts.id })
          .from(facts)
          .where(and(eq(facts.sourceId, DEMO_MODERATED_SOURCE.id), lt(facts.fetchedAt, before)));
        await tx.delete(confirmations).where(inArray(confirmations.factId, expired));
        await tx.delete(facts).where(and(eq(facts.sourceId, DEMO_MODERATED_SOURCE.id), lt(facts.fetchedAt, before)));
        // The demo source exists only while it has facts, so the source list doesn't keep it for good.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${DEMO_SOURCE_LOCK}))`);
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

const DEMO_SOURCE_LOCK = `sources|${DEMO_MODERATED_SOURCE.id}`;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const PENDING: ReportStatus[] = ["new", "needs_info"];

/** The device's report of the place's attribute still awaiting moderation. */
const pendingOf = (contributor: string, placeId: string, attribute: AccessibilityAttribute) =>
  and(
    eq(reports.contributorHash, contributor),
    eq(reports.placeId, placeId),
    eq(reports.attribute, attribute),
    isNull(reports.withdrawnAt),
    inArray(reports.status, PENDING),
  );

// Two sends from one device at once would both find nothing pending and insert twice; this serialises them.
async function lockContribution(tx: Tx, contributor: string, placeId: string, attribute: AccessibilityAttribute) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`contribution|${contributor}|${placeId}|${attribute}`}))`);
}

const toConfirmation = (row: typeof confirmations.$inferSelect): ConfirmationRecord => ({
  id: row.id,
  placeId: row.placeId,
  factId: row.factId,
  comment: row.comment,
  createdAt: row.createdAt,
});

/** Sets the facts' `evidence.confirmations` to the number of confirmations they have now. */
async function recount(tx: Tx, factIds: string[], confirmedAt?: Date) {
  if (factIds.length === 0) return;
  await tx
    .update(facts)
    .set({
      ...(confirmedAt && { confirmedAt }),
      evidence: sql`coalesce(${facts.evidence}, '{}'::jsonb) || jsonb_build_object('confirmations',
        (select count(*)::int from ${confirmations} where ${confirmations.factId} = ${facts.id}))`,
    })
    .where(inArray(facts.id, factIds));
}

async function insertConfirmation(
  tx: Tx,
  input: { placeId: string; factId: string; comment: string | null; at: Date; contributor: string | null },
): Promise<ConfirmationRecord> {
  const [row] = await tx
    .insert(confirmations)
    .values({
      placeId: input.placeId,
      factId: input.factId,
      comment: input.comment,
      createdAt: input.at,
      contributorHash: input.contributor,
    })
    .returning();
  await recount(tx, [input.factId], input.at);
  return toConfirmation(row);
}

/**
 * Removes the device's confirmations of the place's attribute and recounts the facts. A withdrawn confirmation is
 * not kept: it is an anonymous "still true" vote that no longer holds, and every count reads the rows directly.
 */
async function withdrawConfirmations(
  tx: Tx,
  { contributor, placeId, attribute }: { contributor: string; placeId: string; attribute: AccessibilityAttribute },
) {
  const ofAttribute = tx
    .select({ id: facts.id })
    .from(facts)
    .where(and(eq(facts.placeId, placeId), eq(facts.attribute, attribute)));
  const removed = await tx
    .delete(confirmations)
    .where(
      and(
        eq(confirmations.contributorHash, contributor),
        eq(confirmations.placeId, placeId),
        inArray(confirmations.factId, ofAttribute),
      ),
    )
    .returning({ factId: confirmations.factId });
  await recount(tx, [...new Set(removed.map((r) => r.factId))]);
}

/** The store the route handlers use, over the shared database client. */
export function reportsStore(): ReportsStore {
  return createDrizzleReportsStore(getDb());
}
