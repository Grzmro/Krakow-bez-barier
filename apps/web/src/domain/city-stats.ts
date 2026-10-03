import type {
  Category,
  CityNeedStats,
  CityStats,
  Need,
  NeedVerdict,
  PriorityCriterion,
  PriorityFactor,
  PriorityItem,
  ReportStatus,
} from "@krakow-bez-barier/contracts";
import { defaultLocale } from "@/i18n/locale";
import { matchProfile } from "./matcher";
import { PROFILE_PRESETS, type Thresholds } from "./profiles";
import { isStale } from "./resolver";
import type { ResolvedAttribute } from "./types";

/** One place as the city statistics see it: its resolved attributes and the statuses of its reports. */
export type CityPlace = {
  id: string;
  name: string;
  category: Category;
  location: PriorityItem["location"];
  attributes: ResolvedAttribute[];
  reports: { status: ReportStatus }[];
};

/** The wheelchair profile's needs plus a smooth surface — the strictest check the app makes. */
export const AUDIT_THRESHOLDS: Thresholds = { ...PROFILE_PRESETS.wheelchair, requireSmoothSurface: true };

/** Categories many people visit; they add points only to a place that already has another reason. */
export const BUSY_CATEGORIES: Category[] = ["toilet", "pharmacy", "museum", "theatre", "transit_stop"];

/** The scoring, in the order the panel explains it. A place's score is the sum of `points × min(count, max)`. */
export const PRIORITY_CRITERIA: PriorityCriterion[] = [
  { factor: "barrier", points: 4, max: null, categories: [] },
  { factor: "open_report", points: 3, max: 3, categories: [] },
  { factor: "conflict", points: 2, max: null, categories: [] },
  { factor: "busy_category", points: 2, max: 1, categories: BUSY_CATEGORIES },
  { factor: "missing_entrance_data", points: 1, max: 1, categories: [] },
  { factor: "stale_data", points: 1, max: 1, categories: [] },
];

const REPORT_STATUSES: ReportStatus[] = ["new", "needs_info", "accepted", "rejected"];
const OPEN_REPORT = new Set<ReportStatus>(["new", "needs_info"]);

type Ranked = Omit<PriorityItem, "rank">;

function rank(place: CityPlace, needs: { need: Need; state: NeedVerdict }[]): Ranked | null {
  const barriers = needs.filter((n) => n.state === "barrier").map((n) => n.need);
  const openReports = place.reports.filter((r) => OPEN_REPORT.has(r.status)).length;
  const counts: Record<PriorityFactor, number> = {
    barrier: barriers.length,
    open_report: openReports,
    conflict: place.attributes.filter((a) => a.state === "conflict").length,
    busy_category: 0,
    missing_entrance_data: needs.some((n) => n.need === "entrance" && n.state === "unknown") ? 1 : 0,
    stale_data: place.attributes.some((a) => a.state === "stale") ? 1 : 0,
  };
  if (Object.values(counts).every((count) => count === 0)) return null;
  counts.busy_category = BUSY_CATEGORIES.includes(place.category) ? 1 : 0;

  const reasons = PRIORITY_CRITERIA.flatMap(({ factor, points, max }) => {
    const count = Math.min(counts[factor], max ?? Number.POSITIVE_INFINITY);
    return count > 0 ? [{ factor, count, points: points * count }] : [];
  });
  return {
    placeId: place.id,
    placeName: place.name,
    category: place.category,
    location: place.location,
    score: reasons.reduce((sum, r) => sum + r.points, 0),
    action: barriers.length > 0 ? "fix" : "verify",
    barriers,
    openReports,
    reasons,
  };
}

const collator = new Intl.Collator("pl", { sensitivity: "base" });

/**
 * Aggregates the city's places into the panel's statistics and ranks them for repair (`fix`, a known barrier) or for
 * filling in data (`verify`). Needs are judged by the same Matcher the place card uses, so unknown is never counted as
 * met. Ties are broken by more barriers, then by name.
 */
export function cityStats(
  places: CityPlace[],
  { now = new Date(), limit = 25, isSample = false }: { now?: Date; limit?: number; isSample?: boolean } = {},
): CityStats {
  const needCounts = new Map<Need, CityNeedStats>();
  const reportCounts = new Map<ReportStatus, number>(REPORT_STATUSES.map((s) => [s, 0]));
  const ranked: Ranked[] = [];
  let withData = 0;
  let staleFacts = 0;
  let stalePlaces = 0;
  let conflictAttributes = 0;
  let conflictPlaces = 0;

  for (const place of places) {
    const facts = place.attributes.flatMap((a) => a.facts);
    if (facts.length > 0) withData += 1;
    const stale = facts.filter((f) => isStale(f, now)).length;
    staleFacts += stale;
    if (stale > 0) stalePlaces += 1;
    const conflicts = place.attributes.filter((a) => a.state === "conflict").length;
    conflictAttributes += conflicts;
    if (conflicts > 0) conflictPlaces += 1;
    for (const report of place.reports) reportCounts.set(report.status, (reportCounts.get(report.status) ?? 0) + 1);

    const needs = matchProfile(place, AUDIT_THRESHOLDS, defaultLocale).needs ?? [];
    for (const { need, state } of needs) {
      const row = needCounts.get(need) ?? { need, met: 0, barrier: 0, unknown: 0, conflict: 0 };
      row[state] += 1;
      needCounts.set(need, row);
    }

    const item = rank(place, needs);
    if (item) ranked.push(item);
  }

  ranked.sort(
    (a, b) => b.score - a.score || b.barriers.length - a.barriers.length || collator.compare(a.placeName, b.placeName),
  );

  return {
    generatedAt: now.toISOString(),
    isSample,
    places: { total: places.length, withData, withoutData: places.length - withData },
    needs: [...needCounts.values()],
    reports: REPORT_STATUSES.map((status) => ({ status, count: reportCounts.get(status) ?? 0 })),
    staleData: { places: stalePlaces, facts: staleFacts },
    conflicts: { places: conflictPlaces, attributes: conflictAttributes },
    criteria: PRIORITY_CRITERIA,
    priorities: {
      total: ranked.length,
      items: ranked.slice(0, limit).map((item, i) => ({ rank: i + 1, ...item })),
    },
  };
}
