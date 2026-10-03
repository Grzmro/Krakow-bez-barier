"use client";

import { forwardRef, useState } from "react";
import Link from "next/link";
import type { FeatureFilter, PlaceSummary } from "@krakow-bez-barier/contracts";
import { Button, cn } from "@krakow-bez-barier/ui";
import { SampleTag, StatusBadge } from "@/components/kbb";
import { NeedGroups } from "@/components/profile/need-groups";
import { useMessages } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import { useCategoryLookup } from "@/lib/categories";
import type { DistanceFrom } from "@/lib/nearby";
import { filterGapStatus, matchFeature, summaryLine } from "@/lib/place-features";
import { routes } from "@/lib/routes";

function chipFallback(chip: PlaceSummary["summary"][number], t: Messages["common"]) {
  const name = t.attribute[chip.attribute];
  if (chip.state === "unknown") return `${name}: ${t.status.unknown.toLowerCase()}`;
  if (chip.state === "conflict") return `${name}: ${t.status.conflict.toLowerCase()}`;
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
  /** The distance is from the user's position ("od Ciebie"), not from Rynek. */
  /** What the distance is measured from. */
  from?: DistanceFrom;
  features: FeatureFilter[];
  selected: boolean;
  onHighlight: (id: string) => void;
}

export const PlaceRow = forwardRef<HTMLAnchorElement, PlaceRowProps>(function PlaceRow(
  { place, distance, from = "centre", features, selected, onHighlight },
  ref,
) {
  const m = useMessages();
  const t = m.home;
  const tp = m.profile.list;
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
          <span className="block truncate text-caption text-muted-foreground">{address(place)}</span>
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
