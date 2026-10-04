"use client";

import { forwardRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";
import type { FeatureFilter, PlaceSummary } from "@krakow-bez-barier/contracts";
import { Button, cn } from "@krakow-bez-barier/ui";
import { SampleTag, StatusBadge } from "@/components/kbb";
import { NeedGroups } from "@/components/profile/need-groups";
import { useMessages } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import { useCategoryLookup } from "@/lib/categories";
import { LIST_PAGE } from "@/lib/list-window";
import type { DistanceFrom } from "@/lib/nearby";
import { filterGapStatus, formatAddress, matchFeature, summaryLine } from "@/lib/place-features";
import { routes } from "@/lib/routes";

/** Words for a summary chip without its own label, with its state when it is not known. */
export function chipFallback(chip: PlaceSummary["summary"][number], t: Messages["common"]) {
  const name = t.attribute[chip.attribute];
  if (chip.state === "unknown") return `${name}: ${t.status.unknown.toLowerCase()}`;
  if (chip.state === "conflict") return `${name}: ${t.status.conflict.toLowerCase()}`;
  return name;
}

export interface PlaceRowProps {
  place: PlaceSummary;
  /** Meters from the reference point. */
  distance: number;
  /** The distance is from the user's position ("od Ciebie"), not from Rynek. */
  /** What the distance is measured from. */
  from?: DistanceFrom;
  features: FeatureFilter[];
  selected: boolean;
  onHighlight: (id: string) => void;
  /** Position in the list: rows of a new page enter one short beat after another. */
  index?: number;
}

/** Beats (see `motion-enter`) a row waits before entering; capped so the last rows aren't kept waiting. */
export const enterStagger = (index: number) => Math.min(index % LIST_PAGE, MAX_STAGGER);
const MAX_STAGGER = 5;

/** Grey stand-ins for rows still loading, about a plain row tall, so the list has its shape before the data arrives. Hidden from assistive tech: the heading says "Ładowanie…". */
export function PlaceListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden data-skeleton className="space-y-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-[20px] bg-surface-raised p-3 pr-3.5 shadow-soft ring-1 ring-border/70">
          <span className="size-[52px] shrink-0 self-start rounded-2xl bg-muted motion-safe:animate-pulse" />
          <span className="min-w-0 flex-1 space-y-2 py-1">
            <span className="block h-4 w-3/5 rounded-full bg-muted motion-safe:animate-pulse" />
            <span className="block h-3 w-4/5 rounded-full bg-muted motion-safe:animate-pulse" />
            <span className="block h-3 w-2/5 rounded-full bg-muted motion-safe:animate-pulse" />
          </span>
        </div>
      ))}
    </div>
  );
}

export const PlaceRow = forwardRef<HTMLAnchorElement, PlaceRowProps>(function PlaceRow(
  { place, distance, from = "centre", features, selected, onHighlight, index = 0 },
  ref,
) {
  const m = useMessages();
  const t = m.home;
  const tp = m.profile.list;
  const [open, setOpen] = useState(false);
  // Kept after closing, so the details can fold away instead of vanishing.
  const [opened, setOpened] = useState(false);
  const I = useCategoryLookup()(place.category).icon;
  const verdict = place.verdict;
  const gap = features.length ? filterGapStatus(place, features) : null;
  const gapFilters =
    verdict && gap
      ? features
          .filter((feature) => matchFeature(place, feature) !== "met")
          .map((feature) => t.filters[feature])
          .join(", ")
      : undefined;
  const detailsId = `need-groups-${place.id}`;
  return (
    <li
      data-selected={selected}
      style={{ "--stagger": enterStagger(index) } as CSSProperties}
      className={cn(
        "motion-enter rounded-[20px] bg-surface-raised shadow-soft ring-1 ring-border/70 transition-shadow has-[a:hover]:ring-primary/40",
        "data-[selected=true]:ring-2 data-[selected=true]:ring-primary",
      )}
    >
      <Link
        ref={ref}
        href={routes.place(place.id)}
        onFocus={() => onHighlight(place.id)}
        onMouseEnter={() => onHighlight(place.id)}
        className="press flex w-full items-center gap-3.5 rounded-[20px] p-3 pr-3.5 text-left"
      >
        <span className="grid size-[52px] shrink-0 place-items-center self-start rounded-2xl bg-primary-container text-primary">
          <I weight="duotone" className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          {verdict ? (
            <span data-verdict={verdict.state} className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge
                status={verdict.state}
                reason={verdict.state === "met" ? undefined : verdict.reasons[0]}
                unconfirmed={verdict.unconfirmed}
                className="max-w-full"
              />
              {gap ? <StatusBadge status={gap} size="sm" reason={gapFilters} className="max-w-full" /> : null}
            </span>
          ) : gap ? (
            <StatusBadge status={gap} size="sm" className="mb-1.5 max-w-full" />
          ) : null}
          <span className="block text-[17px] leading-6 font-semibold">{place.name}</span>
          <span className="block truncate text-caption text-muted-foreground">{formatAddress(place.address)}</span>
          {verdict ? null : (
            <span className="mt-1 block text-caption leading-[18px] font-medium text-foreground/80">
              {summaryLine(place.summary, (chip) => chipFallback(chip, m.common))}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end justify-between gap-2 self-stretch py-0.5">
          {place.isSample ? <SampleTag /> : <span />}
          <span className="text-caption font-medium text-muted-foreground tabular-nums">
            {t.list.distance(distance, from)}
          </span>
        </span>
      </Link>
      {verdict?.needs?.length ? (
        <div className="border-t border-border/60 px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1 pr-3 pl-3.5"
            aria-label={open ? tp.hideDetailsAria(place.name) : tp.detailsAria(place.name, verdict.state)}
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => {
              setOpen((v) => !v);
              setOpened(true);
            }}
          >
            {open ? tp.hideDetails : tp.details}
            <CaretDown aria-hidden weight="bold" className={cn("transition-transform duration-(--duration-base)", open && "rotate-180")} />
          </Button>
          <div id={detailsId} hidden={!open} className="reveal">
            <div>
              <div className="mt-2 rounded-2xl bg-muted p-3 ring-1 ring-border/60 ring-inset">
                {opened ? <NeedGroups verdict={verdict} headingLevel={3} /> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
});
