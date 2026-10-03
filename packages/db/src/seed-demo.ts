import type { FactValue } from "@krakow-bez-barier/contracts";
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import demoPlaces from "../seed/demo-places.json" with { type: "json" };
import { facts, places, sources, type FactEvidence } from "./schema";

type SeedFact = {
  attribute: (typeof facts.$inferInsert)["attribute"];
  value: FactValue;
  unit: string | null;
  source: string;
  recordRef: string;
  observedAt: string | null;
  evidence: FactEvidence | null;
};

const seededAt = new Date("2026-10-03T00:00:00Z");

const seedSources: (typeof sources.$inferInsert)[] = [
  {
    id: "osm",
    name: "OpenStreetMap",
    kind: "community",
    license: "ODbL 1.0",
    attribution: "© OpenStreetMap contributors",
    url: "https://www.openstreetmap.org",
    refreshInterval: "daily",
    baseReliability: "community",
    refreshStatus: "ok",
    lastSuccessAt: seededAt,
    lastAttemptAt: seededAt,
    statusNote: "Seeded from an Overpass snapshot, not an ingestion run",
  },
  {
    id: "msip-toilets",
    name: "MSIP: Toalety publiczne",
    kind: "official_open_data",
    license: "To be confirmed (KBB-20)",
    url: "https://msip.um.krakow.pl/arcgis/rest/services/Obserwatorium/WT_WC_2023/MapServer/0",
    refreshInterval: "unknown",
    baseReliability: "confirmed",
    refreshStatus: "ok",
    lastSuccessAt: seededAt,
    lastAttemptAt: seededAt,
    statusNote: "Seeded from a one-off query, not an ingestion run",
  },
  {
    id: "msip-koh",
    name: "MSIP: Obiekty hotelarskie KOH",
    kind: "official_open_data",
    license: "To be confirmed (KBB-20)",
    url: "https://msip.um.krakow.pl/arcgis/rest/services/Obserwatorium/WT_OBIEKTY_HOTELOWE_KOH/MapServer/0",
    refreshInterval: "unknown",
    baseReliability: "confirmed",
    refreshStatus: "never",
  },
];

/**
 * Seed rows written before the MSIP adapter existed used refs without the source prefix. Re-pointing the
 * ref keeps the fact's id, confirmations and history; a legacy row is only superseded when a prefixed
 * active twin already exists (the unique index would otherwise reject the update).
 */
const REPOINT_LEGACY_MSIP_REFS = sql`
  update facts f set source_record_ref = 'msip-toilets:' || f.source_record_ref
  where f.source_id = 'msip-toilets' and f.status = 'active' and f.source_record_ref not like 'msip-toilets:%'
    and not exists (
      select 1 from facts g
      where g.source_id = f.source_id and g.status = 'active' and g.subject = f.subject
        and g.attribute = f.attribute and g.source_record_ref = 'msip-toilets:' || f.source_record_ref
    )`;
const SUPERSEDE_LEGACY_TWINS = sql`${facts.sourceId} = 'msip-toilets' and ${facts.status} = 'active' and ${facts.sourceRecordRef} not like 'msip-toilets:%'`;

function sameValue(a: FactValue, b: FactValue): boolean {
  return JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(b).sort());
}

/**
 * Loads the demo places and their facts; safe to run again. A fact that already exists with the same
 * value is left alone, one whose value changed is superseded and replaced — never overwritten.
 * Returns the number of places and of facts inserted.
 */
export async function seedDemoData(db: Db): Promise<{ places: number; newFacts: number }> {
  return db.transaction(async (tx) => {
    await tx.insert(sources).values(seedSources).onConflictDoNothing();
    await tx.execute(REPOINT_LEGACY_MSIP_REFS);
    await tx.update(facts).set({ status: "superseded", supersededAt: sql`now()` }).where(SUPERSEDE_LEGACY_TWINS);
    const baseReliability = new Map(seedSources.map((s) => [s.id, s.baseReliability]));

    let factCount = 0;
    for (const p of demoPlaces) {
      const [place] = await tx
        .insert(places)
        .values({
          externalRef: p.externalRef,
          name: p.name,
          category: p.category as (typeof places.$inferInsert)["category"],
          location: { x: p.lon, y: p.lat },
          street: p.street,
          houseNumber: p.houseNumber,
        })
        .onConflictDoUpdate({
          target: places.externalRef,
          set: {
            name: p.name,
            location: { x: p.lon, y: p.lat },
            street: p.street,
            houseNumber: p.houseNumber,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: places.id });

      for (const f of p.facts as SeedFact[]) {
        const reliability = baseReliability.get(f.source);
        if (!reliability) throw new Error(`unknown source ${f.source} in seed data`);

        const [existing] = await tx
          .select({ id: facts.id, value: facts.value })
          .from(facts)
          .where(
            and(
              eq(facts.placeId, place.id),
              eq(facts.sourceId, f.source),
              eq(facts.sourceRecordRef, f.recordRef),
              eq(facts.subject, "place"),
              eq(facts.attribute, f.attribute),
              eq(facts.status, "active"),
            ),
          );
        if (existing && sameValue(existing.value, f.value)) continue;
        if (existing) {
          await tx.update(facts).set({ status: "superseded", supersededAt: sql`now()` }).where(eq(facts.id, existing.id));
        }

        await tx.insert(facts).values({
          placeId: place.id,
          attribute: f.attribute,
          value: f.value,
          unit: f.unit,
          sourceId: f.source,
          sourceRecordRef: f.recordRef,
          fetchedAt: new Date(p.fetchedAt),
          observedAt: f.observedAt ? new Date(f.observedAt) : null,
          reliability,
          evidence: f.evidence,
        });
        factCount += 1;
      }
    }

    return { places: demoPlaces.length, newFacts: factCount };
  });
}
