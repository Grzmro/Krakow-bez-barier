import type {
  AccessibilityAttribute,
  Category,
  DataAgeBucket,
  DataQualityCategory,
  DataQualityReport,
  Reliability,
} from "@krakow-bez-barier/contracts";
import { RELIABILITY_RANK } from "./config";
import { effectiveDate } from "./resolver";
import type { AccessibilityFact, ResolvedAttribute } from "./types";

/** One place as the report sees it: its category and resolved attributes. */
export type QualityPlace = { category: Category; attributes: ResolvedAttribute[] };

const DAY_MS = 86_400_000;

export const AGE_BUCKETS: { bucket: DataAgeBucket; maxDays: number }[] = [
  { bucket: "within_90_days", maxDays: 90 },
  { bucket: "within_365_days", maxDays: 365 },
  { bucket: "older", maxDays: Number.POSITIVE_INFINITY },
];

const RELIABILITY_LEVELS = (Object.keys(RELIABILITY_RANK) as Reliability[])
  .filter((r) => r !== "sample")
  .sort((a, b) => RELIABILITY_RANK[b] - RELIABILITY_RANK[a]);

const collator = new Intl.Collator("en");

/** Whole days since the fact was last true; never negative. */
export function factAgeDays(fact: AccessibilityFact, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - effectiveDate(fact, now).getTime()) / DAY_MS));
}

/** Median rounded to whole days; null for no values. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

type CategoryTally = { places: number; withData: number; conflicts: number; stale: number; ages: number[] };

/**
 * Measures the data: coverage per category (unknown is "no data", never counted as accessible), age and reliability of
 * the facts, conflicts, outdated attributes, per-attribute coverage and the sources behind the facts. The input is what
 * the place card resolves, so a conflict or an outdated attribute means exactly what it does there. Sample data must be
 * left out by the caller; `isSample` only labels an all-sample answer.
 */
export function dataQuality(
  places: QualityPlace[],
  { now = new Date(), isSample = false }: { now?: Date; isSample?: boolean } = {},
): DataQualityReport {
  const byCategory = new Map<Category, CategoryTally>();
  const attributePlaces = new Map<AccessibilityAttribute, number>();
  const reliabilityFacts = new Map<Reliability, number>();
  const sources = new Map<string, DataQualityReport["sources"][number]>();
  const allAges: number[] = [];
  let withData = 0;
  let conflictPlaces = 0;
  let conflictAttributes = 0;
  let stalePlaces = 0;
  let staleFacts = 0;

  for (const place of places) {
    const tally = byCategory.get(place.category) ?? { places: 0, withData: 0, conflicts: 0, stale: 0, ages: [] };
    tally.places += 1;

    let hasFact = false;
    let conflicts = 0;
    let stale = 0;
    for (const attribute of place.attributes) {
      const known = attributePlaces.get(attribute.attribute) ?? 0;
      attributePlaces.set(attribute.attribute, known + (attribute.facts.length > 0 ? 1 : 0));
      if (attribute.facts.length > 0) hasFact = true;
      if (attribute.state === "conflict") conflicts += 1;
      if (attribute.state === "stale") {
        stale += 1;
        staleFacts += attribute.facts.length;
      }
      for (const fact of attribute.facts) {
        const age = factAgeDays(fact, now);
        allAges.push(age);
        tally.ages.push(age);
        reliabilityFacts.set(fact.reliability, (reliabilityFacts.get(fact.reliability) ?? 0) + 1);
        const source = sources.get(fact.source.id);
        sources.set(fact.source.id, {
          sourceId: fact.source.id,
          name: fact.source.name,
          kind: fact.source.kind,
          facts: (source?.facts ?? 0) + 1,
          newestFetchedAt: source && source.newestFetchedAt > fact.fetchedAt ? source.newestFetchedAt : fact.fetchedAt,
        });
      }
    }

    if (hasFact) {
      withData += 1;
      tally.withData += 1;
    }
    if (conflicts > 0) conflictPlaces += 1;
    if (stale > 0) stalePlaces += 1;
    conflictAttributes += conflicts;
    tally.conflicts += conflicts;
    tally.stale += stale;
    byCategory.set(place.category, tally);
  }

  const categories: DataQualityCategory[] = [...byCategory.entries()]
    .map(([category, t]) => ({
      category,
      places: t.places,
      withData: t.withData,
      withoutData: t.places - t.withData,
      conflictAttributes: t.conflicts,
      staleAttributes: t.stale,
      medianAgeDays: median(t.ages),
    }))
    .sort((a, b) => b.withoutData - a.withoutData || collator.compare(a.category, b.category));

  return {
    generatedAt: now.toISOString(),
    isSample,
    places: { total: places.length, withData, withoutData: places.length - withData },
    categories,
    facts: {
      total: allAges.length,
      medianAgeDays: median(allAges),
      age: AGE_BUCKETS.map(({ bucket, maxDays }, i) => {
        const min = i === 0 ? -1 : AGE_BUCKETS[i - 1].maxDays;
        return { bucket, facts: allAges.filter((age) => age > min && age <= maxDays).length };
      }),
    },
    reliability: RELIABILITY_LEVELS.map((reliability) => ({ reliability, facts: reliabilityFacts.get(reliability) ?? 0 })),
    conflicts: { places: conflictPlaces, attributes: conflictAttributes },
    staleData: { places: stalePlaces, facts: staleFacts },
    attributes: [...attributePlaces.entries()]
      .map(([attribute, count]) => ({ attribute, places: count }))
      .sort((a, b) => a.places - b.places || collator.compare(a.attribute, b.attribute)),
    sources: [...sources.values()].sort((a, b) => b.facts - a.facts || collator.compare(a.sourceId, b.sourceId)),
  };
}

/** Share of `part` in `total` as a whole percent, 0 for an empty total. */
export const percent = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 100));
