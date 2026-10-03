import type { AccessibilityAttribute, AccessibilityFact, Route, RouteSegment } from "@krakow-bez-barier/contracts";
import type { Locale } from "@/i18n/locale";
import { messagesFor, type Messages } from "@/i18n/messages";
import { SMOOTH_SURFACES } from "@/domain/matcher";
import { resolveAttribute } from "@/domain/resolver";
import type { NeedVerdict, ResolvedAttribute } from "@/domain/types";
import type { ExtraRange, LonLat, ProviderRoute } from "./provider";

/** Limits a segment is checked against when a profile is on. */
export type RouteThresholds = { maxKerbCm: number; maxInclinePct: number; smoothSurface: boolean };

/** A fact from our sources at a point near the route (e.g. a kerb at a crossing). */
export type NearbyFact = { fact: AccessibilityFact; location: LonLat };

export type BuildRouteInput = {
  route: ProviderRoute;
  kind: Route["kind"];
  fallback: boolean;
  thresholds: RouteThresholds | null;
  nearby: NearbyFact[];
  attribution: string;
  /** When the provider computed the route — the date of every fact it reports. */
  fetchedAt: Date;
  now: Date;
  /** Language of the segment notes; default Polish. */
  locale?: Locale;
};

// OSM-derived data reported by openrouteservice: the source of the facts it gives us.
export const ROUTING_SOURCE: AccessibilityFact["source"] = {
  id: "openrouteservice",
  name: "OpenStreetMap (przez openrouteservice)",
  kind: "community",
  recordRef: null,
};

// openrouteservice `surface` codes → the OSM `surface` values the app labels; 0 is "unknown".
const ORS_SURFACE: Record<number, string> = {
  1: "paved",
  2: "unpaved",
  3: "asphalt",
  4: "concrete",
  5: "cobblestone",
  6: "metal",
  7: "wood",
  8: "compacted",
  9: "fine_gravel",
  10: "gravel",
  11: "dirt",
  12: "ground",
  13: "ice",
  14: "paving_stones",
  15: "sand",
  16: "woodchips",
  17: "grass",
  18: "grass_paver",
};

// Smooth surfaces first, so the roughest surface on a segment is the one that speaks for it.
const SURFACE_ORDER = ["asphalt", "concrete", "paved", "paving_stones", "metal", "wood", "grass_paver", "compacted"];
const roughness = (surface: string) => {
  const index = SURFACE_ORDER.indexOf(surface);
  return index === -1 ? SURFACE_ORDER.length : index;
};

// openrouteservice `steepness` classes → upper bound of the incline in %, by absolute class (0: under 1%).
const STEEPNESS_MAX_PCT = [1, 3, 6, 11, 15, 16];

const WAYTYPE_UNKNOWN = 0;
const WAYTYPE_STEPS = 8;

/** Ranges overlapping coordinates `[from, to]`, and whether they cover all of it. */
function overlapping(ranges: ExtraRange[], from: number, to: number) {
  const hits = ranges.filter((r) => r.from < to && r.to > from).sort((a, b) => a.from - b.from);
  let reached = from;
  for (const r of hits) {
    if (r.from > reached) break;
    reached = Math.max(reached, r.to);
  }
  return { hits, covered: reached >= to };
}

function routingFact(segmentId: number, attribute: AccessibilityAttribute, value: AccessibilityFact["value"], fetchedAt: string, reliability: AccessibilityFact["reliability"] = "community"): AccessibilityFact {
  return {
    id: `ors-${segmentId}-${attribute}`,
    attribute,
    value,
    unit: value.kind === "number" ? (value.unit ?? null) : null,
    source: ROUTING_SOURCE,
    fetchedAt,
    observedAt: null,
    confirmedAt: null,
    reliability,
    evidence: null,
    status: "active",
    stale: false,
  };
}

type SegmentData = { facts: AccessibilityFact[]; surfacePartlyUnknown: boolean; stepCounts: number[] };

function providerFacts(route: ProviderRoute, id: number, from: number, to: number, fetchedAt: string): SegmentData {
  const facts: AccessibilityFact[] = [];

  const surface = overlapping(route.extras.surface, from, to);
  const surfaces = surface.hits.map((r) => ORS_SURFACE[r.value]).filter((s): s is string => Boolean(s));
  if (surfaces.length) {
    const worst = surfaces.reduce((a, b) => (roughness(b) > roughness(a) ? b : a));
    facts.push(routingFact(id, "surface", { kind: "text", text: worst }, fetchedAt));
  }
  const surfacePartlyUnknown = !surface.covered || surface.hits.some((r) => !ORS_SURFACE[r.value]);

  const waytype = overlapping(route.extras.waytype, from, to);
  if (waytype.hits.some((r) => r.value === WAYTYPE_STEPS)) {
    facts.push(routingFact(id, "stairs", { kind: "boolean", boolean: true }, fetchedAt));
  } else if (waytype.covered && waytype.hits.every((r) => r.value !== WAYTYPE_UNKNOWN)) {
    facts.push(routingFact(id, "stairs", { kind: "boolean", boolean: false }, fetchedAt));
  }

  // Steepness comes from an elevation model, not a survey: an estimate.
  const steepness = overlapping(route.extras.steepness, from, to);
  if (steepness.covered && steepness.hits.length) {
    const steepest = Math.max(...steepness.hits.map((r) => Math.min(Math.abs(r.value), STEEPNESS_MAX_PCT.length - 1)));
    const pct = STEEPNESS_MAX_PCT[steepest];
    facts.push(routingFact(id, "incline_pct", { kind: "number", number: pct, unit: "pct" }, fetchedAt, "inferred"));
  }

  return { facts, surfacePartlyUnknown, stepCounts: [] };
}

// Equirectangular projection around the route: metres, accurate enough within a city.
function projector(origin: LonLat) {
  const k = Math.cos((origin[1] * Math.PI) / 180);
  return ([lon, lat]: LonLat) => [lon * 111_320 * k, lat * 110_540] as const;
}

function distanceToLine(point: LonLat, line: LonLat[], project: ReturnType<typeof projector>): number {
  const [px, py] = project(point);
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i += 1) {
    const [ax, ay] = project(line[i]);
    const [bx, by] = project(line[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const u = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
    best = Math.min(best, Math.hypot(px - (ax + u * dx), py - (ay + u * dy)));
  }
  return best;
}

const numberOf = (a: ResolvedAttribute | undefined) => (a?.state === "known" && a.value?.kind === "number" ? a.value.number : null);
const textOf = (a: ResolvedAttribute | undefined) => (a?.state === "known" && a.value?.kind === "text" ? a.value.text : null);
const booleanOf = (a: ResolvedAttribute | undefined) => (a?.state === "known" && a.value?.kind === "boolean" ? a.value.boolean : null);

function surfaceLabel(m: Messages, surface: string) {
  return m.place.surface[surface] ?? surface;
}

/** The segment's state and its short reason; unknown and conflicting data never pass. */
function judge(attributes: Map<AccessibilityAttribute, ResolvedAttribute>, data: SegmentData, th: RouteThresholds | null, m: Messages) {
  const t = m.route.note;
  const barriers: string[] = [];
  if (booleanOf(attributes.get("stairs")) === true) barriers.push(data.stepCounts.length ? t.stairsSteps(data.stepCounts) : t.stairs);
  const kerb = numberOf(attributes.get("kerb_height_cm"));
  const incline = numberOf(attributes.get("incline_pct"));
  const surface = textOf(attributes.get("surface"));
  if (th && kerb !== null && kerb > th.maxKerbCm) barriers.push(t.kerb(kerb));
  if (th && incline !== null && incline > th.maxInclinePct) barriers.push(t.incline(incline));
  if (th?.smoothSurface && surface !== null && !SMOOTH_SURFACES.has(surface)) barriers.push(t.rough(surfaceLabel(m, surface)));
  if (barriers.length) return { state: "barrier" as NeedVerdict, note: barriers.join(t.separator) };

  const conflicts = [...attributes.values()].filter((a) => a.state === "conflict");
  if (conflicts.length) {
    return { state: "conflict" as NeedVerdict, note: t.conflict(conflicts.map((a) => m.common.attribute[a.attribute].toLowerCase()).join(t.separator)) };
  }

  const missing: string[] = [];
  const surfaceKnown = attributes.get("surface")?.state === "known";
  if (!surfaceKnown) missing.push(t.noSurface);
  else if (data.surfacePartlyUnknown) missing.push(t.partSurface);
  if (attributes.get("stairs")?.state !== "known") missing.push(t.noStairs);
  if (th && attributes.get("incline_pct")?.state !== "known") missing.push(t.noIncline);
  if (missing.length) return { state: "unknown" as NeedVerdict, note: missing.join(t.separator) };

  // Kerbs come only from our facts (the provider reports none): with a profile, a segment without kerb data is unknown, not met.
  const kerbUnknown = th !== null && kerb === null;
  const notes = [
    surface ? surfaceLabel(m, surface) : null,
    th && incline !== null ? (incline <= 1 ? t.inclineLow : t.incline(incline)) : null,
    kerbUnknown ? t.noKerb : null,
  ];
  return { state: (kerbUnknown ? "unknown" : "met") as NeedVerdict, note: notes.filter(Boolean).join(t.separator) || null };
}

/**
 * Splits a provider route into segments (one per instruction), attaches the facts found on each — from the
 * provider and from our sources nearby — and judges every segment: stairs are always a barrier; with a
 * profile so are kerbs and inclines over its limits and, if it asks for it, an uneven surface. A segment
 * lacking surface or stairs data (or incline or kerb, with a profile) is `unknown`, never met.
 */
export function buildRoute(input: BuildRouteInput): Route {
  const { route, thresholds, now } = input;
  const messages = messagesFor(input.locale);
  const fetchedAt = input.fetchedAt.toISOString();
  const project = projector(route.coordinates[0]);

  const steps = route.steps.filter((s) => s.to > s.from && s.distanceMeters > 0);
  const lines = steps.map((s) => route.coordinates.slice(s.from, s.to + 1));

  const nearbyBySegment = new Map<number, AccessibilityFact[]>();
  for (const { fact, location } of input.nearby) {
    let best = -1;
    let bestDistance = Infinity;
    lines.forEach((line, index) => {
      const d = distanceToLine(location, line, project);
      if (d < bestDistance) [best, bestDistance] = [index, d];
    });
    if (best >= 0) nearbyBySegment.set(best, [...(nearbyBySegment.get(best) ?? []), fact]);
  }

  const segments: RouteSegment[] = steps.map((step, index) => {
    const id = index + 1;
    const provided = providerFacts(route, id, step.from, step.to, fetchedAt);
    const hasStairs = provided.facts.some((f) => f.attribute === "stairs" && f.value.kind === "boolean" && f.value.boolean);
    // A mapped flight of steps only says how many steps there are where the provider routes over stairs: its
    // centre being near the line does not put it on the route.
    const near = (nearbyBySegment.get(index) ?? []).filter((f) => f.attribute !== "step_count" || hasStairs);
    const stepCounts = [...new Set(near.flatMap((f) => (f.attribute === "step_count" && f.value.kind === "number" ? [f.value.number] : [])))];
    const data = { ...provided, stepCounts };
    const facts = [...data.facts, ...near];
    const attributes = new Map(
      [...new Set(facts.map((f) => f.attribute))].map((attribute) => [attribute, resolveAttribute(attribute, facts, now)]),
    );
    const { state, note } = judge(attributes, data, thresholds, messages);
    return {
      id,
      name: step.name,
      instruction: step.instruction,
      lengthMeters: Math.round(step.distanceMeters),
      state,
      note,
      facts,
      geometry: { type: "LineString", coordinates: lines[index] },
    };
  });

  const unknown = segments.filter((s) => s.state === "unknown");
  return {
    kind: input.kind,
    fallback: input.fallback,
    durationMinutes: Math.max(1, Math.round(route.durationSeconds / 60)),
    distanceMeters: Math.round(route.distanceMeters),
    geometry: { type: "LineString", coordinates: route.coordinates },
    knownBarrierCount: segments.filter((s) => s.state === "barrier").length,
    unknownSegmentCount: unknown.length,
    unknownMeters: unknown.reduce((sum, s) => sum + s.lengthMeters, 0),
    segments,
    attribution: input.attribution,
  };
}
