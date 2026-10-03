import type { Route, RouteSegment } from "@krakow-bez-barier/contracts";
import type { Locale } from "@/i18n/locale";
import type { Messages } from "@/i18n/messages";
import { formatValue } from "./place-facts";

/** A segment's state label; an unknown segment with some facts says it is only partly unknown. */
export function segmentStatusLabel(m: Messages, segment: RouteSegment) {
  return segment.state === "unknown" && segment.facts.length ? m.route.partlyUnknown : m.common.status[segment.state];
}

/** What "Czytaj na głos" says for one segment: the step, its state and barriers, the surface — or that data is missing. */
export function segmentSpeech(m: Messages, segment: RouteSegment, index: number, total: number, locale: Locale): string {
  const t = m.route.speech;
  const surfaces = [
    ...new Set(
      segment.facts.filter((fact) => fact.attribute === "surface").map((fact) => formatValue(fact.attribute, fact.value, locale).value),
    ),
  ];
  return [
    t.step(index + 1, total, segment.instruction, segment.lengthMeters),
    t.state(segmentStatusLabel(m, segment), segment.note ?? ""),
    surfaces.length ? t.surface(surfaces.join(", ")) : t.noSurface,
    segment.facts.length ? null : t.nobody,
  ]
    .filter(Boolean)
    .join(" ");
}

/** One utterance per segment, so reading can pause and resume at a step. */
export function routeSpeech(m: Messages, route: Route, locale: Locale): string[] {
  return route.segments.map((segment, index) => segmentSpeech(m, segment, index, route.segments.length, locale));
}
