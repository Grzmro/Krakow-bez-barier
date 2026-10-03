"use client";

import { forwardRef, useState } from "react";
import Link from "next/link";
import type { FeatureFilter, PlaceSummary } from "@krakow-bez-barier/contracts";
import { Button, cn } from "@krakow-bez-barier/ui";
import { SampleTag, StatusBadge } from "@/components/kbb";
import { NeedGroups } from "@/components/profile/need-groups";
import { pl } from "@/i18n/pl";
import { useCategoryLookup } from "@/lib/categories";
import { filterGapStatus, matchFeature, summaryLine } from "@/lib/place-features";
import { routes } from "@/lib/routes";

const t = pl.home;
const tp = pl.profile.list;

function chipFallback(chip: PlaceSummary["summary"][number]) {
  const name = pl.common.attribute[chip.attribute];
  if (chip.state === "unknown") return `${name}: ${pl.common.status.unknown.toLowerCase()}`;
  if (chip.state === "conflict") return `${name}: ${pl.common.status.conflict.toLowerCase()}`;
  return name;
}

function address(place: PlaceSummary) {
  const a = place.address;
  if (!a) return "";
  return [[a.street, a.houseNumber].filter(Boolean).join(" "), a.city].filter(Boolean).join(", ");
}

export interface PlaceRowProps {
  place: PlaceSummary;
  /** Meters from the reference point. */
  distance: number;
  features: FeatureFilter[];
  selected: boolean;
  onHighlight: (id: string) => void;
}

export const PlaceRow = forwardRef<HTMLAnchorElement, PlaceRowProps>(function PlaceRow(
  { place, distance, features, selected, onHighlight },
  ref,
) {
  const [open, setOpen] = useState(false);
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
  const badges = verdict ? (
    <>
      <StatusBadge
        status={verdict.state}
        reason={verdict.state === "met" ? undefined : verdict.reasons[0]}
        unconfirmed={verdict.state === "met" && verdict.unconfirmed}
      />
      {gap ? <StatusBadge status={gap} size="sm" reason={gapFilters} /> : null}
    </>
  ) : gap ? (
    <StatusBadge status={gap} size="sm" />
  ) : null;
  return (
    <li
      data-selected={selected}
      className={cn(
        "rounded-[20px] bg-surface-raised shadow-soft ring-1 ring-border/70 has-[a:hover]:ring-primary/40",
        "data-[selected=true]:ring-2 data-[selected=true]:ring-primary",
      )}
    >
      <Link
        ref={ref}
        href={routes.place(place.id)}
        onFocus={() => onHighlight(place.id)}
        onMouseEnter={() => onHighlight(place.id)}
        className="press grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3.5 rounded-[20px] p-3 pr-3.5 text-left"
      >
        <span
          className={cn(
            "grid size-[52px] shrink-0 place-items-center self-start rounded-2xl bg-primary-container text-primary",
            badges && "row-span-2",
          )}
        >
          <I weight="duotone" className="size-6" aria-hidden />
        </span>
        {badges ? <span className="col-span-2 mb-1.5 flex min-w-0 flex-wrap items-center gap-1.5">{badges}</span> : null}
        <span className="col-start-2 min-w-0">
          <span className="block text-[17px] leading-6 font-semibold">{place.name}</span>
          <span className="block truncate text-caption text-muted-foreground">{address(place)}</span>
          {verdict ? null : (
            <span className="mt-1 block text-caption leading-[18px] font-medium text-foreground/80">
              {summaryLine(place.summary, chipFallback)}
            </span>
          )}
        </span>
        <span className="col-start-3 flex shrink-0 flex-col items-end justify-between gap-2 self-stretch py-0.5">
          {place.isSample ? <SampleTag /> : <span />}
          <span className="text-caption font-medium text-muted-foreground tabular-nums">
            {t.list.distance(distance)}
          </span>
        </span>
      </Link>
      {verdict?.needs?.length ? (
        <div className="px-3 pb-2">
          <Button
            variant="link"
            size="sm"
            className="h-10 px-1"
            aria-label={open ? tp.hideDetailsAria(place.name) : tp.detailsAria(place.name)}
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? tp.hideDetails : tp.details}
          </Button>
          <div id={detailsId} hidden={!open} className="pt-1 pb-2">
            {open ? <NeedGroups verdict={verdict} headingLevel={3} /> : null}
          </div>
        </div>
      ) : null}
    </li>
  );
});
