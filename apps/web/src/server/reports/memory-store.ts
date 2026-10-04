import type { AccessibilityFact } from "@krakow-bez-barier/contracts";
import { randomUUID } from "node:crypto";
import { DEMO_MODERATED_SOURCE } from "./demo";
import { COMMUNITY_MODERATED_SOURCE } from "./drizzle-store";
import type { ConfirmationRecord, ContributionRecord, ModerationEventRecord, ReportRecord, ReportsStore } from "./store";

type MemoryPlace = { id: string; name: string; externalRef?: string };
type MemoryFact = AccessibilityFact & { placeId: string; recordRef: string };
type MemoryReport = ReportRecord & { contributor: string | null; withdrawnAt: Date | null };
type MemoryConfirmation = ConfirmationRecord & { contributor: string | null };

/** In-memory `ReportsStore` for tests — same contract as the Drizzle store, no database. */
export function createMemoryReportsStore(seed: { places?: MemoryPlace[]; facts?: MemoryFact[] } = {}) {
  const places = [...(seed.places ?? [])];
  const facts = [...(seed.facts ?? [])];
  const reports: MemoryReport[] = [];
  const confirmations: MemoryConfirmation[] = [];
  const log: (ModerationEventRecord & { reportId: string })[] = [];
  let tick = 0;
  // Strictly increasing timestamps keep insertion order stable for the queue.
  const nextDate = () => new Date(Date.UTC(2026, 9, 3, 9, 0, 0, tick++));
  const isPending = (r: MemoryReport) => !r.withdrawnAt && (r.status === "new" || r.status === "needs_info");
  const pendingOf = (contributor: string, placeId: string, attribute: string) =>
    reports.find((r) => r.contributor === contributor && r.placeId === placeId && r.attribute === attribute && isPending(r));
  const recount = (factId: string, confirmedAt?: Date) => {
    const fact = facts.find((f) => f.id === factId);
    if (!fact) return;
    if (confirmedAt) fact.confirmedAt = confirmedAt.toISOString();
    const own = confirmations.filter((c) => c.factId === factId);
    fact.evidence = {
      ...fact.evidence,
      confirmations: own.length,
      confirmationDates: own.map((c) => c.createdAt.toISOString()).sort().reverse(),
    };
  };
  const publicConfirmation = (c: MemoryConfirmation): ConfirmationRecord => ({
    id: c.id,
    placeId: c.placeId,
    factId: c.factId,
    comment: c.comment,
    createdAt: c.createdAt,
  });
  const addConfirmation = (input: { placeId: string; factId: string; comment: string | null; at: Date; contributor: string | null }) => {
    const record: MemoryConfirmation = { id: randomUUID(), placeId: input.placeId, factId: input.factId, comment: input.comment, createdAt: input.at, contributor: input.contributor };
    confirmations.push(record);
    recount(input.factId, input.at);
    return publicConfirmation(record);
  };
  const withdrawConfirmations = (contributor: string, placeId: string, attribute: string) => {
    const ofAttribute = new Set(facts.filter((f) => f.placeId === placeId && f.attribute === attribute).map((f) => f.id));
    for (const c of confirmations.filter((c) => c.contributor === contributor && c.placeId === placeId && ofAttribute.has(c.factId))) {
      confirmations.splice(confirmations.indexOf(c), 1);
      recount(c.factId);
    }
  };
  const publicReport = (r: MemoryReport): ReportRecord => ({
    id: r.id,
    placeId: r.placeId,
    attribute: r.attribute,
    value: r.value,
    comment: r.comment,
    photoUrl: r.photoUrl,
    status: r.status,
    createdAt: r.createdAt,
    decidedAt: r.decidedAt,
  });

  const store: ReportsStore = {
    async findPlace(ref) {
      const place = places.find((p) => p.id === ref || p.externalRef === ref);
      return place ? { id: place.id, name: place.name } : null;
    },
    async insertReport(report) {
      const record: MemoryReport = {
        ...report,
        id: randomUUID(),
        photoUrl: null,
        status: "new",
        createdAt: nextDate(),
        decidedAt: null,
        contributor: null,
        withdrawnAt: null,
      };
      reports.push(record);
      return publicReport(record);
    },
    async saveContributorReport({ contributor, placeId, attribute, value, comment }) {
      withdrawConfirmations(contributor, placeId, attribute);
      const pending = pendingOf(contributor, placeId, attribute);
      if (pending) {
        Object.assign(pending, { value, comment, createdAt: nextDate() });
        return { report: publicReport(pending), replaced: true };
      }
      const record: MemoryReport = {
        placeId,
        attribute,
        value,
        comment,
        id: randomUUID(),
        photoUrl: null,
        status: "new",
        createdAt: nextDate(),
        decidedAt: null,
        contributor,
        withdrawnAt: null,
      };
      reports.push(record);
      return { report: publicReport(record), replaced: false };
    },
    async findActiveFact(placeId, factId) {
      const fact = facts.find((f) => f.id === factId && f.placeId === placeId && f.status === "active");
      return fact ? { id: fact.id, attribute: fact.attribute } : null;
    },
    async confirmFact({ placeId, factId, comment, at }) {
      return addConfirmation({ placeId, factId, comment, at, contributor: null });
    },
    async confirmFactAsContributor({ placeId, factId, attribute, comment, at, contributor, admit }) {
      const existing = confirmations.find((c) => c.contributor === contributor && c.factId === factId);
      if (existing) return { confirmation: publicConfirmation(existing), created: false };
      admit();
      const pending = pendingOf(contributor, placeId, attribute);
      if (pending) pending.withdrawnAt = at;
      withdrawConfirmations(contributor, placeId, attribute);
      return { confirmation: addConfirmation({ placeId, factId, comment, at, contributor }), created: true };
    },
    async listContributions(placeId, contributor) {
      const own = reports
        .filter((r) => r.contributor === contributor && r.placeId === placeId && isPending(r))
        .map((r): ContributionRecord => ({ kind: "report", id: r.id, attribute: r.attribute, value: r.value, factId: null, createdAt: r.createdAt }));
      const confirmed = confirmations.flatMap((c): ContributionRecord[] => {
        const fact = facts.find((f) => f.id === c.factId && f.status === "active");
        if (c.contributor !== contributor || c.placeId !== placeId || !fact) return [];
        return [{ kind: "confirmation", id: c.id, attribute: fact.attribute, value: fact.value, factId: fact.id, createdAt: c.createdAt }];
      });
      return [...own, ...confirmed];
    },
    async withdrawContributions({ placeId, attribute, contributor, at }) {
      const pending = pendingOf(contributor, placeId, attribute);
      if (pending) pending.withdrawnAt = at;
      withdrawConfirmations(contributor, placeId, attribute);
    },
    async listQueue({ status, limit, after }) {
      return reports
        .filter((r) => !r.withdrawnAt && (!status || r.status === status))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
        .filter(
          (r) =>
            !after ||
            r.createdAt > after.createdAt ||
            (r.createdAt.getTime() === after.createdAt.getTime() && r.id > after.id),
        )
        .slice(0, limit)
        .map((report) => ({
          report: publicReport(report),
          placeName: places.find((p) => p.id === report.placeId)!.name,
          currentFacts: facts.filter(
            (f) => f.placeId === report.placeId && f.attribute === report.attribute && f.status === "active",
          ),
          history: log
            .filter((e) => e.reportId === report.id)
            .map(({ decision, note, moderator, createdAt }) => ({ decision, note, moderator, createdAt })),
        }));
    },
    async decide({ reportId, decision, note, moderator, demo, at, toFact }) {
      const report = reports.find((r) => r.id === reportId);
      if (!report || report.withdrawnAt) return { kind: "not_found" };
      if (report.status === "accepted" || report.status === "rejected") return { kind: "final", status: report.status };
      report.status = decision;
      report.decidedAt = at;
      log.push({ reportId, decision, note, moderator, createdAt: at });
      if (decision === "accepted") {
        const fact = toFact(publicReport(report));
        const moderatedSource = demo ? DEMO_MODERATED_SOURCE : COMMUNITY_MODERATED_SOURCE;
        for (const old of facts) {
          if (
            old.source.id === moderatedSource.id &&
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
            id: moderatedSource.id,
            name: moderatedSource.name,
            kind: moderatedSource.kind,
            recordRef: fact.sourceRecordRef,
          },
          fetchedAt: fact.fetchedAt.toISOString(),
          observedAt: fact.observedAt.toISOString(),
          confirmedAt: fact.confirmedAt.toISOString(),
          reliability: moderatedSource.baseReliability,
          evidence: { comment: fact.comment, photoUrl: fact.photoUrl },
          status: "active",
          stale: false,
        });
      }
      return { kind: "decided", report: publicReport(report) };
    },
    async listPending(placeId) {
      return reports.filter((r) => r.placeId === placeId && isPending(r)).map(publicReport);
    },
    async revertDemoDecisions({ moderator, before }) {
      const undone = log.filter((e) => e.moderator === moderator && e.createdAt < before);
      for (const entry of undone) log.splice(log.indexOf(entry), 1);
      for (const reportId of new Set(undone.map((e) => e.reportId))) {
        const report = reports.find((r) => r.id === reportId)!;
        const latest = log.filter((e) => e.reportId === reportId).at(-1);
        report.status = latest?.decision ?? "new";
        report.decidedAt = latest?.createdAt ?? null;
        const newer = reports.some(
          (r) => r !== report && r.contributor !== null && r.contributor === report.contributor && r.placeId === report.placeId && r.attribute === report.attribute && isPending(r),
        );
        if (isPending(report) && newer) report.withdrawnAt = before;
      }
      const expired = facts.filter((f) => f.source.id === DEMO_MODERATED_SOURCE.id && Date.parse(f.fetchedAt) < before.getTime());
      for (const fact of expired) {
        facts.splice(facts.indexOf(fact), 1);
        for (const c of confirmations.filter((c) => c.factId === fact.id)) confirmations.splice(confirmations.indexOf(c), 1);
      }
      return undone.length;
    },
  };

  return { store, places, facts, reports, confirmations, log };
}
