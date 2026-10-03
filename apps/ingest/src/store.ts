import { and, eq, sql } from "drizzle-orm";
import {
  facts,
  ingestionRuns,
  places,
  sources,
  type Db,
  type LonLat,
} from "@krakow-bez-barier/db";
import type { FactValue } from "@krakow-bez-barier/contracts";
import type { MappedFact, MappedPlace, SourceMeta } from "./adapter";
import type { IngestStore } from "./runner";

const NEARBY_METRES = 30;
const NEARBY_TOILET_METRES = 15;

function sameValue(a: FactValue, b: FactValue): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "boolean") return a.boolean === (b as typeof a).boolean;
  if (a.kind === "number") {
    return a.number === (b as typeof a).number && (a.unit ?? null) === ((b as typeof a).unit ?? null);
  }
  return a.text === (b as typeof a).text;
}

const baseRef = (ref: string) => ref.split("@")[0];

/** The source's fresh evidence, keeping the community confirmation count the web app stores on the same fact. */
const keepConfirmations = (evidence: MappedFact["evidence"]) => {
  const fresh = sql`${evidence ? JSON.stringify(evidence) : null}::jsonb`;
  return sql`case when ${facts.evidence} -> 'confirmations' is null then ${fresh}
    else coalesce(${fresh}, '{}'::jsonb) || jsonb_build_object('confirmations', ${facts.evidence} -> 'confirmations') end`;
};

const normalizeName = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/gi, "l").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function namesMatch(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  return x === y || (x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x)));
}

export function drizzleStore(db: Db): IngestStore {
  type Found = { id: string; owned: boolean };

  async function findPlace(meta: SourceMeta, place: MappedPlace): Promise<Found | null> {
    const [byRef] = await db
      .select({ id: places.id })
      .from(places)
      .where(eq(places.externalRef, place.externalRef));
    if (byRef) return { id: byRef.id, owned: true };

    const [byFact] = await db
      .select({ id: facts.placeId })
      .from(facts)
      .where(
        and(
          eq(facts.sourceId, meta.id),
          eq(facts.status, "active"),
          sql`split_part(${facts.sourceRecordRef}, '@', 1) = ${place.externalRef}`,
        ),
      )
      .limit(1);
    if (byFact) return { id: byFact.id, owned: false };

    const { x, y } = place.location;
    const radius = place.category === "toilet" ? NEARBY_TOILET_METRES : NEARBY_METRES;
    const prefix = `${place.externalRef.split(":")[0]}:`;
    const nearby = await db
      .select({ id: places.id, name: places.name, externalRef: places.externalRef })
      .from(places)
      .where(
        and(
          eq(places.category, place.category),
          sql`ST_DWithin(${places.location}::geography, ST_SetSRID(ST_MakePoint(${x}, ${y}), 4326)::geography, ${radius})`,
        ),
      );
    // A place already owned by another record of the same source is a different place.
    const candidates = nearby.filter((p) => !p.externalRef?.startsWith(prefix));
    const match = candidates.find((p) => place.category === "toilet" || namesMatch(p.name, place.name));
    return match ? { id: match.id, owned: false } : null;
  }

  async function applyFacts(
    tx: Pick<Db, "select" | "update" | "insert">,
    meta: SourceMeta,
    placeId: string,
    mapped: MappedFact[],
    refs: Set<string>,
    fetchedAt: Date,
  ): Promise<number> {
    const active = await tx
      .select()
      .from(facts)
      .where(and(eq(facts.placeId, placeId), eq(facts.sourceId, meta.id), eq(facts.status, "active")));
    let changed = 0;

    for (const f of mapped) {
      const existing = active.find(
        (a) => baseRef(a.sourceRecordRef) === baseRef(f.recordRef) && a.subject === "place" && a.attribute === f.attribute,
      );
      if (existing && sameValue(existing.value, f.value)) {
        await tx
          .update(facts)
          .set({
            fetchedAt,
            observedAt: f.observedAt,
            sourceRecordRef: f.recordRef,
            evidence: keepConfirmations(f.evidence),
            reliability: meta.baseReliability,
          })
          .where(eq(facts.id, existing.id));
        continue;
      }
      if (existing) {
        await tx
          .update(facts)
          .set({ status: "superseded", supersededAt: fetchedAt })
          .where(eq(facts.id, existing.id));
      }
      await tx.insert(facts).values({
        placeId,
        attribute: f.attribute,
        value: f.value,
        sourceId: meta.id,
        sourceRecordRef: f.recordRef,
        fetchedAt,
        observedAt: f.observedAt,
        reliability: meta.baseReliability,
        evidence: f.evidence,
      });
      changed += 1;
    }

    // A tag that disappeared from the record: the fact is superseded, never deleted.
    for (const a of active) {
      const stillThere = mapped.some((f) => f.attribute === a.attribute && baseRef(f.recordRef) === baseRef(a.sourceRecordRef));
      if (!stillThere && refs.has(baseRef(a.sourceRecordRef))) {
        await tx.update(facts).set({ status: "superseded", supersededAt: fetchedAt }).where(eq(facts.id, a.id));
        changed += 1;
      }
    }
    return changed;
  }

  return {
    async upsertSource(meta) {
      const values = {
        id: meta.id,
        name: meta.name,
        kind: meta.kind,
        license: meta.license,
        termsUrl: meta.termsUrl ?? null,
        attribution: meta.attribution,
        url: meta.url,
        refreshInterval: meta.refreshInterval,
        baseReliability: meta.baseReliability,
      };
      await db.insert(sources).values(values).onConflictDoUpdate({ target: sources.id, set: values });
    },

    async startRun(sourceId) {
      const [run] = await db
        .insert(ingestionRuns)
        .values({ sourceId, status: "partial" })
        .returning({ id: ingestionRuns.id });
      return run.id;
    },

    async finishRun(runId, summary) {
      await db
        .update(ingestionRuns)
        .set({
          status: summary.status,
          finishedAt: new Date(),
          recordsSeen: summary.recordsSeen,
          recordsWritten: summary.recordsWritten,
          recordsSkipped: summary.recordsSkipped,
          error: summary.error,
        })
        .where(eq(ingestionRuns.id, runId));
    },

    async applyPlace(meta, place, fetchedAt) {
      return db.transaction(async (tx) => {
        const found = await findPlace(meta, place);
        let placeId = found?.id ?? null;
        if (!placeId) {
          const location: LonLat = place.location;
          const [created] = await tx
            .insert(places)
            .values({
              externalRef: place.externalRef,
              name: place.name,
              category: place.category,
              location,
              street: place.street,
              houseNumber: place.houseNumber,
            })
            .returning({ id: places.id });
          placeId = created.id;
        } else if (found?.owned) {
          await tx
            .update(places)
            .set({
              name: place.name,
              category: place.category,
              location: place.location,
              street: place.street,
              houseNumber: place.houseNumber,
              updatedAt: fetchedAt,
            })
            .where(eq(places.id, placeId));
        } else {
          await tx
            .update(places)
            .set({
              street: sql`coalesce(${places.street}, ${place.street})`,
              houseNumber: sql`coalesce(${places.houseNumber}, ${place.houseNumber})`,
              updatedAt: fetchedAt,
            })
            .where(eq(places.id, placeId));
        }
        const refs = new Set([baseRef(place.externalRef)]);
        return applyFacts(tx, meta, placeId, place.facts, refs, fetchedAt);
      });
    },

    async markSource(sourceId, outcome, at) {
      if (outcome.ok) {
        await db
          .update(sources)
          .set({ refreshStatus: "ok", lastSuccessAt: at, lastAttemptAt: at, statusNote: null })
          .where(eq(sources.id, sourceId));
        return;
      }
      await db
        .update(sources)
        .set({
          refreshStatus: "outage",
          lastAttemptAt: at,
          statusNote: outcome.error.slice(0, 500),
        })
        .where(eq(sources.id, sourceId));
    },
  };
}
