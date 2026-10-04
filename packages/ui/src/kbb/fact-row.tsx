"use client";

import { useId, useState, type ReactNode } from "react";
import { ArrowSquareOut, CaretDown, ClockCounterClockwise } from "@phosphor-icons/react";
import { cn } from "../cn";
import type { Reliability, Status } from "../types";
import { ReliabilityBadge, StatusBadge } from "./status";

export interface FactSource {
  /** Source name, e.g. "OpenStreetMap". */
  name: string;
  /** When we fetched it, already formatted for display. */
  date: string;
  /** What this source says, e.g. "80 cm" — needed when sources disagree. */
  value?: string;
  /** Extra line, e.g. "2/2 potwierdzeń". */
  detail?: string;
  /** Staleness warning, e.g. "Może być nieaktualne · 2021-05-04". */
  staleNote?: string;
  /** What the source says, e.g. the quoted sentence a fact was read from. */
  note?: string;
  /** The page the fact comes from, e.g. { href: "https://www.bip.krakow.pl/?mmi=1", label: "Strona źródła" }. */
  link?: { href: string; label: string };
}

export interface FactRowLabels {
  /** "Źródło" */
  source: string;
  /** "Pozyskano" */
  acquired: string;
  /** "Brak danych" — shown when there is no value. */
  noValue: string;
  /** "Nikt jeszcze nie sprawdził." — shown when there are no sources. */
  noSources: string;
}

export interface FactRowProps {
  /** Decorative icon element (aria-hidden is up to the caller's icon). */
  icon?: ReactNode;
  /** Attribute name, e.g. "Drzwi". */
  label: string;
  /** Value without the unit; omit when unknown. */
  value?: string;
  unit?: string;
  /** The user's threshold, e.g. "min. 80 cm". */
  limit?: string;
  /** Verdict of this fact against the user's need. */
  status?: { value: Status; label: string };
  reliability: { value: Reliability; label: string };
  sources: FactSource[];
  labels: FactRowLabels;
  /** Accessible name for the toggle, read instead of the visible text (avoids "Brak danych Brak danych"). */
  ariaLabel?: string;
  /** Buttons always visible under the value, outside the toggle, so they are one tap from the card (e.g. "To się nie zgadza"). */
  actions?: ReactNode;
  /** Always visible under the value, outside the toggle (e.g. the visitor's own pending report). */
  notice?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/** One accessibility fact: value with unit, verdict, reliability and an expandable provenance list. */
export function FactRow({
  icon,
  label,
  value,
  unit,
  limit,
  status,
  reliability,
  sources,
  labels,
  ariaLabel,
  actions,
  notice,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
}: FactRowProps) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const panelId = useId();
  const toggle = () => {
    setOpenState(!open);
    onOpenChange?.(!open);
  };
  const known = value !== undefined && value !== "";

  return (
    <li className={cn("list-none", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={ariaLabel}
        onClick={toggle}
        className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted focus-visible:-outline-offset-3"
      >
        {icon ? (
          <span aria-hidden className="shrink-0 text-muted-foreground [&_svg]:size-[22px]">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block text-body-sm font-medium text-muted-foreground">{label}</span>
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span
              className={cn(
                "font-display text-[17px] font-extrabold tabular-nums",
                !known && "font-sans text-body-sm font-semibold text-muted-foreground",
              )}
            >
              {known ? (unit ? `${value} ${unit}` : value) : labels.noValue}
            </span>
            {limit ? <span className="text-caption text-muted-foreground">({limit})</span> : null}
          </span>
          {/* Under the value, not beside it: a long reliability label would squeeze the value into a narrow column. */}
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {status ? <StatusBadge status={status.value} label={status.label} size="sm" /> : null}
            <ReliabilityBadge value={reliability.value} label={reliability.label} />
          </span>
        </span>
        <CaretDown
          aria-hidden
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {notice || actions ? (
        <div className="space-y-2 px-4 pb-3">
          {notice}
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div id={panelId} hidden={!open} className="space-y-3 bg-muted px-4 pt-2 pb-4">
        {sources.length ? (
          <ul className="space-y-2.5">
            {sources.map((s, i) => (
              <li key={i} className="flex flex-col gap-0.5 text-caption text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {labels.source}: {s.name}
                  {s.value ? <span className="font-normal"> · {s.value}</span> : null}
                </span>
                <span className="tabular-nums">
                  {labels.acquired} {s.date}
                  {s.detail ? ` · ${s.detail}` : null}
                </span>
                {s.staleNote ? (
                  <span className="flex items-center gap-1 font-semibold text-status-conflict">
                    <ClockCounterClockwise className="size-3.5" aria-hidden />
                    {s.staleNote}
                  </span>
                ) : null}
                {s.note ? <span className="mt-0.5 text-foreground/85">{s.note}</span> : null}
                {s.link ? (
                  <a
                    href={s.link.href}
                    className="inline-flex min-h-6 items-center gap-1 self-start font-semibold text-primary underline underline-offset-2"
                  >
                    {s.link.label}
                    <ArrowSquareOut weight="bold" className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-caption text-muted-foreground">{labels.noSources}</p>
        )}
      </div>
    </li>
  );
}
