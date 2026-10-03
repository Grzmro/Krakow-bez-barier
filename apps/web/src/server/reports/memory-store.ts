import type { AccessibilityFact } from "@krakow-bez-barier/contracts";
import { randomUUID } from "node:crypto";
import { COMMUNITY_MODERATED_SOURCE } from "./drizzle-store";
import type { ConfirmationRecord, ModerationEventRecord, ReportRecord, ReportsStore } from "./store";

type MemoryPlace = { id: string; name: string; externalRef?: string };
type MemoryFact = AccessibilityFact & { placeId: string; recordRef: string };

/** In-memory `ReportsStore` for tests — same contract as the Drizzle store, no database. */
export function createMemoryReportsStore(seed: { places?: MemoryPlace[]; facts?: MemoryFact[] } = {}) {
  const places = [...(seed.places ?? [])];
  const facts = [...(seed.facts ?? [])];
  const reports: ReportRecord[] = [];
  const confirmations: ConfirmationRecord[] = [];
  const log: (ModerationEventRecord & { reportId: string })[] = [];
  let tick = 0;
  // Strictly increasing timestamps keep insertion order stable for the queue.
  const nextDate = () => new Date(Date.UTC(2026, 9, 3, 9, 0, 0, tick++));

  const store: ReportsStore = {
    async findPlace(ref) {
      const place = places.find((p) => p.id === ref || p.externalRef === ref);
      return place ? { id: place.id, name: place.name } : null;
    },
    async insertReport(report) {
      const record: ReportRecord = { ...report, id: randomUUID(), photoUrl: null, status: "new", createdAt: nextDate(), decidedAt: null };
      reports.push(record);
      return record;
    },
    async findActiveFact(placeId, factId) {
      const fact = facts.find((f) => f.id === factId && f.placeId === placeId && f.status === "active");
      return fact ? { id: fact.id } : null;
    },
    async confirmFact({ placeId, factId, comment, at }) {
      const record: ConfirmationRecord = { id: randomUUID(), placeId, factId, comment, createdAt: at };
      confirmations.push(record);
      const fact = facts.find((f) => f.id === factId)!;
      fact.confirmedAt = at.toISOString();
      fact.evidence = { ...fact.evidence, confirmations: confirmations.filter((c) => c.factId === factId).length };
      return record;
    },
    async listQueue({ status, limit, after }) {
      return reports
        .filter((r) => !status || r.status === status)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
        .filter(
          (r) =>
            !after ||
            r.createdAt > after.createdAt ||
            (r.createdAt.getTime() === after.createdAt.getTime() && r.id > after.id),
        )
        .slice(0, limit)
        .map((report) => ({
          report: { ...report },
          placeName: places.find((p) => p.id === report.placeId)!.name,
          currentFacts: facts.filter(
            (f) => f.placeId === report.placeId && f.attribute === report.attribute && f.status === "active",
          ),
          history: log
            .filter((e) => e.reportId === report.id)
            .map(({ decision, note, moderator, createdAt }) => ({ decision, note, moderator, createdAt })),
        }));
    },
    async decide({ reportId, decision, note, moderator, at, toFact }) {
      const report = reports.find((r) => r.id === reportId);
      if (!report) return { kind: "not_found" };
      if (report.status === "accepted" || report.status === "rejected") return { kind: "final", status: report.status };
      report.status = decision;
      report.decidedAt = at;
      log.push({ reportId, decision, note, moderator, createdAt: at });
      if (decision === "accepted") {
        const fact = toFact({ ...report });
        for (const old of facts) {
          if (
            old.source.id === COMMUNITY_MODERATED_SOURCE.id &&
            old.recordRef === fact.sourceRecordRef &&
            old.attribute === fact.attribute &&
            old.status === "active"
          ) {
            old.status = "superseded";
          }
        }
        facts.push({
          id: randomUUID(),
          placeId: fact.placeId,
          recordRef: fact.sourceRecordRef,
          attribute: fact.attribute,
          value: fact.value,
          unit: fact.unit,
          source: {
            id: COMMUNITY_MODERATED_SOURCE.id,
            name: COMMUNITY_MODERATED_SOURCE.name,
            kind: COMMUNITY_MODERATED_SOURCE.kind,
            recordRef: fact.sourceRecordRef,
          },
          fetchedAt: fact.fetchedAt.toISOString(),
          observedAt: fact.observedAt.toISOString(),
          confirmedAt: fact.confirmedAt.toISOString(),
          reliability: COMMUNITY_MODERATED_SOURCE.baseReliability,
          evidence: { comment: fact.comment, photoUrl: fact.photoUrl },
          status: "active",
          stale: false,
        });
      }
      return { kind: "decided", report: { ...report } };
    },
    async listPending(placeId) {
      return reports.filter((r) => r.placeId === placeId && (r.status === "new" || r.status === "needs_info"));
    },
  };

  return { store, places, facts, reports, confirmations, log };
}
