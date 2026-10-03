import type { FactValue } from "@krakow-bez-barier/contracts";
import { sql } from "drizzle-orm";
import { createDb } from "./client";
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

const { db, close } = createDb();

await db.insert(sources).values(seedSources).onConflictDoNothing();
const baseReliability = new Map(seedSources.map((s) => [s.id, s.baseReliability]));

let factCount = 0;
for (const p of demoPlaces) {
  const [place] = await db
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
    const inserted = await db
      .insert(facts)
      .values({
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
      })
      .onConflictDoNothing()
      .returning({ id: facts.id });
    factCount += inserted.length;
  }
}

await close();
console.log(`seeded ${demoPlaces.length} places, ${factCount} new facts`);
