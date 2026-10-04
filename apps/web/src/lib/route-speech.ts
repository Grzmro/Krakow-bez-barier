import type { Route, RouteSegment } from "@krakow-bez-barier/contracts";
import type { Locale } from "@/i18n/locale";
import type { Messages } from "@/i18n/messages";
import { earMeters, type Announcement } from "./announcements";
import { concerns, provenance, type Progress } from "./navigation";
import { formatDate, formatValue } from "./place-facts";

type Speech = Messages["route"]["speech"];

/** A segment's state label; an unknown segment with some facts says it is only partly unknown. */
export function segmentStatusLabel(m: Messages, segment: RouteSegment) {
  return segment.state === "unknown" && segment.facts.length ? m.route.partlyUnknown : m.common.status[segment.state];
}

/** Display text made speakable: units in words ("4 cm" → "4 centymetry", "8%" → "8 procent"), no symbols a voice would spell out. */
export function spokenUnits(t: Speech, text: string): string {
  return text
    .replace(/(\d+(?:[.,]\d+)?)\s?cm\b/g, (_, value: string) => t.centimeters(value))
    .replace(/(\d+(?:[.,]\d+)?)\s?%/g, (_, value: string) => t.percent(value))
    .replace(/\s*(?:→|·|—)\s*/g, ", ");
}

/** A distance for the ear: rounded, in words ("50 metrów", "1,2 kilometra"). */
export function distanceSpeech(t: Speech, meters: number): string {
  const rounded = earMeters(meters);
  return rounded < 1000 ? t.meters(rounded) : t.kilometers(rounded / 1000);
}

const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1);

/** What a segment that isn't fine is about, for the ear: the barrier, the conflict, or the missing data — never "fine". */
export function concernSpeech(m: Messages, segment: RouteSegment): string {
  const t = m.route.speech;
  const note = segment.note ? spokenUnits(t, segment.note) : null;
  const what =
    segment.state === "barrier"
      ? t.barrier(note ?? m.common.status.barrier)
      : segment.state === "unknown" && !segment.facts.length
        ? t.noData
        : (note ?? segmentStatusLabel(m, segment));
  return segment.facts.some((fact) => fact.reliability === "sample") ? `${what}, ${t.sample}` : what;
}

/** Where a segment's facts come from, for the ear: each source with its date and reliability. Said only when asked for. */
export function sourcesSpeech(m: Messages, segment: RouteSegment, locale: Locale): string | null {
  const t = m.route.speech;
  const sources = provenance(segment);
  if (!sources.length) return null;
  const list = sources.map((source) => {
    const line = t.source(source.name, formatDate(source.fetchedAt, locale, "long"), m.place.level[source.reliability]);
    return source.stale ? `${line}, ${t.stale}` : line;
  });
  return t.sources(list.join("; "));
}

/** The words of one scheduled announcement (see `announce`): its cues in order, as one utterance. */
export function announcementSpeech(m: Messages, route: Route, announcement: Announcement): string {
  const t = m.route.speech;
  const segments = route.segments;
  const turn = announcement.cues.find((cue) => cue.kind === "turn");
  const parts = announcement.cues.map((cue) => {
    switch (cue.kind) {
      case "offRoute":
        return t.offRoute;
      case "arrived":
        return t.arrived;
      case "enter": {
        const segment = segments[cue.step];
        const instruction = cue.now ? t.now(lowerFirst(segment.instruction)) : segment.instruction;
        const last = cue.step === segments.length - 1;
        // A turn said in the same breath gives the distance itself.
        const line = turn
          ? t.enterShort(instruction)
          : last
            ? t.enterLast(instruction, distanceSpeech(t, segment.lengthMeters))
            : t.enter(instruction, distanceSpeech(t, segment.lengthMeters));
        return cue.concern ? `${line} ${t.here(concernSpeech(m, segment))}` : line;
      }
      case "turn":
        return cue.step >= segments.length
          ? t.goalIn(distanceSpeech(t, cue.inMeters))
          : t.turnIn(distanceSpeech(t, cue.inMeters), lowerFirst(segments[cue.step].instruction));
      case "concern": {
        const what = concernSpeech(m, segments[cue.step]);
        return turn && turn.step === cue.step ? t.there(what) : t.ahead(distanceSpeech(t, cue.inMeters), what);
      }
    }
  });
  return parts.join(" ");
}

/**
 * The whole picture at the walker's step, for "Powtórz komunikat" and the steps of manual mode: the step, the next turn,
 * the step's own barrier or gap (with its sources when `withSources`), the next one ahead, and what's left.
 */
export function guidanceSpeech(m: Messages, route: Route, progress: Progress, locale: Locale, withSources: boolean): string {
  const t = m.route.speech;
  const segments = route.segments;
  if (progress.offRoute) return t.offRoute;
  if (progress.arrived) return t.arrived;
  const segment = segments[progress.step];
  const next = segments[progress.step + 1];
  const { here, ahead } = concerns(route, progress);
  const sources = here && withSources ? sourcesSpeech(m, here.segment, locale) : null;
  return [
    t.stepOf(progress.step + 1, segments.length),
    t.enterShort(segment.instruction),
    next ? t.turnIn(distanceSpeech(t, progress.toStepEnd), lowerFirst(next.instruction)) : t.goalIn(distanceSpeech(t, progress.toStepEnd)),
    here ? t.here(concernSpeech(m, here.segment)) : null,
    sources,
    ahead ? t.ahead(distanceSpeech(t, ahead.inMeters), concernSpeech(m, ahead.segment)) : null,
    t.remaining(distanceSpeech(t, progress.remainingMeters), progress.remainingMinutes),
  ]
    .filter(Boolean)
    .join(" ");
}

/** What the route preview says for one segment: the step, its state and barriers, the surface — or that data is missing. */
export function segmentSpeech(m: Messages, segment: RouteSegment, index: number, total: number, locale: Locale): string {
  const t = m.route.speech;
  const surfaces = [
    ...new Set(
      segment.facts.filter((fact) => fact.attribute === "surface").map((fact) => formatValue(fact.attribute, fact.value, locale).value),
    ),
  ];
  const text = [
    t.step(index + 1, total, segment.instruction, segment.lengthMeters),
    t.state(segmentStatusLabel(m, segment), segment.note ?? ""),
    surfaces.length ? t.surface(surfaces.join(", ")) : t.noSurface,
    segment.facts.length ? null : t.nobody,
  ]
    .filter(Boolean)
    .join(" ");
  return spokenUnits(t, text);
}

/** One utterance per segment, so "Przeczytaj całą trasę" can be stopped at a step and the step highlighted. */
export function routeSpeech(m: Messages, route: Route, locale: Locale): string[] {
  return route.segments.map((segment, index) => segmentSpeech(m, segment, index, route.segments.length, locale));
}
