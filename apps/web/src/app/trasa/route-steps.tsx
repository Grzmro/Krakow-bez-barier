"use client";

import type { Ref, RefObject } from "react";
import { CaretDown } from "@phosphor-icons/react";
import type { AccessibilityFact, Route, RouteSegment } from "@krakow-bez-barier/contracts";
import { cn, StatusIcon, type Status } from "@krakow-bez-barier/ui";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/locale";
import type { Messages } from "@/i18n/messages";
import { formatDate, formatValue, joinValue } from "@/lib/place-facts";
import { segmentStatusLabel } from "@/lib/route-speech";

const STEP_DOT: Record<Status, string> = {
  met: "bg-status-met-bg",
  barrier: "bg-status-barrier-bg",
  conflict: "bg-status-conflict-bg",
  unknown: "border-[1.5px] border-dashed border-status-unknown bg-status-unknown-bg",
};

export const STATUS_TEXT: Record<Status, string> = {
  met: "text-muted-foreground",
  barrier: "text-status-barrier",
  conflict: "text-status-conflict",
  unknown: "text-status-unknown",
};

/** The "Krok po kroku" list: the text version of the map, one expandable item per segment. */
export function StepList({
  route,
  selected,
  onSelect,
  stepRefs,
  current,
  idPrefix = "odcinek",
}: {
  route: Route;
  selected: number | null;
  onSelect: (id: number | null) => void;
  stepRefs: RefObject<Map<number, HTMLButtonElement>>;
  /** Index of the step being walked (guidance mode). */
  current?: number;
  /** Keeps the step details' ids unique when several lists share a page (saved routes). */
  idPrefix?: string;
}) {
  const t = useMessages().route;
  const total = route.segments.length;
  return (
    <ol aria-label={t.stepsAria}>
      {route.segments.map((segment, index) => (
        <SegmentItem
          key={segment.id}
          segment={segment}
          index={index}
          total={total}
          detailsId={`${idPrefix}-${segment.id}`}
          open={selected === segment.id}
          current={current === index}
          ref={(node) => {
            if (node) stepRefs.current.set(segment.id, node);
            else stepRefs.current.delete(segment.id);
          }}
          onToggle={() => onSelect(selected === segment.id ? null : segment.id)}
        />
      ))}
    </ol>
  );
}

function factLine(m: Messages, fact: AccessibilityFact, locale: Locale) {
  return `${m.common.attribute[fact.attribute]}: ${joinValue(formatValue(fact.attribute, fact.value, locale))}`;
}

function SegmentItem({
  segment,
  index,
  total,
  open,
  current,
  detailsId,
  onToggle,
  ref,
}: {
  segment: RouteSegment;
  index: number;
  total: number;
  open: boolean;
  current: boolean;
  detailsId: string;
  onToggle: () => void;
  ref: Ref<HTMLButtonElement>;
}) {
  const m = useMessages();
  const t = m.route;
  const locale = useLocale();
  const status = segment.state;
  const last = index === total - 1;
  const label = segmentStatusLabel(m, segment);
  const line = [segment.name, `${label}${segment.note ? `: ${segment.note}` : ""}`].filter(Boolean).join(" · ");
  return (
    <li className="relative flex gap-3" aria-current={current ? "step" : undefined}>
      <div className="flex w-9 shrink-0 flex-col items-center pt-3">
        <span className={cn("grid size-9 place-items-center rounded-full transition-shadow duration-(--duration-base)", STEP_DOT[status], current && "ring-3 ring-primary")}>
          <StatusIcon status={status} className="size-5" />
        </span>
        {!last ? (
          <span
            aria-hidden
            className={cn("mt-1 w-0 flex-1 border-l-2", status === "unknown" ? "border-dashed border-status-unknown/60" : "border-primary/40")}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 pb-2">
        <button
          ref={ref}
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={`${t.segmentAria(index + 1, total, segment.instruction, segment.lengthMeters, label, segment.note ?? "")}${current ? ` ${t.nav.current}.` : ""}`}
          onClick={onToggle}
          className={cn(
            "flex min-h-14 w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted",
            open && "bg-primary-container hover:bg-primary-container",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold">{segment.instruction}</span>
            <span className={cn("block text-body-sm", STATUS_TEXT[status])}>{line}</span>
          </span>
          <span className="font-display text-[15px] font-extrabold text-muted-foreground tabular-nums">{t.meters(segment.lengthMeters)}</span>
          <CaretDown className={cn("size-4 text-muted-foreground transition-transform duration-(--duration-base)", open && "rotate-180")} aria-hidden />
        </button>
        <div id={detailsId} hidden={!open} className="reveal">
          <div>
            <div className="px-3 pt-1 pb-2">
              {segment.facts.length ? (
                <ul className="space-y-1.5">
                  {segment.facts.map((fact) => (
                    <li key={fact.id} className="text-caption">
                      <span className="font-semibold text-foreground">{factLine(m, fact, locale)}</span>
                      <span className="block text-muted-foreground">
                        {t.sourceLine(fact.source.name, formatDate(fact.fetchedAt, locale))} · {m.place.level[fact.reliability]}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-caption text-muted-foreground">{t.nobody}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
