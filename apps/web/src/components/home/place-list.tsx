"use client";

import { forwardRef } from "react";
import Link from "next/link";
import {
  Bank,
  Bed,
  Church,
  ForkKnife,
  MapPin,
  MaskHappy,
  ShoppingBag,
  Toilet,
  type Icon,
} from "@phosphor-icons/react";
import type { Category, FeatureFilter, PlaceSummary } from "@krakow-bez-barier/contracts";
import { cn } from "@krakow-bez-barier/ui";
import { SampleTag, StatusBadge } from "@/components/kbb";
import { pl } from "@/i18n/pl";
import { filterGapStatus, summaryLine } from "@/lib/place-features";
import { routes } from "@/lib/routes";

const t = pl.home;

const CATEGORY_ICON: Record<Category, Icon> = {
  restaurant: ForkKnife,
  museum: Bank,
  toilet: Toilet,
  hotel: Bed,
  monument: Church,
  theatre: MaskHappy,
  shop: ShoppingBag,
  other: MapPin,
};

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
  const I = CATEGORY_ICON[place.category];
  const gap = features.length ? filterGapStatus(place.summary, features) : null;
  return (
    <li>
      <Link
        ref={ref}
        href={routes.place(place.id)}
        data-selected={selected}
        onFocus={() => onHighlight(place.id)}
        onMouseEnter={() => onHighlight(place.id)}
        className={cn(
          "press flex w-full items-center gap-3.5 rounded-[20px] bg-surface-raised p-3 pr-3.5 text-left shadow-soft ring-1 ring-border/70 hover:ring-primary/40",
          "data-[selected=true]:ring-2 data-[selected=true]:ring-primary",
        )}
      >
        <span className="grid size-[52px] shrink-0 place-items-center self-start rounded-2xl bg-primary-container text-primary">
          <I weight="duotone" className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          {gap ? <StatusBadge status={gap} size="sm" className="mb-1.5 max-w-full" /> : null}
          <span className="block text-[17px] leading-6 font-semibold">{place.name}</span>
          <span className="block truncate text-caption text-muted-foreground">{address(place)}</span>
          <span className="mt-1 block text-caption leading-[18px] font-medium text-foreground/80">
            {summaryLine(place.summary, chipFallback)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end justify-between gap-2 self-stretch py-0.5">
          {place.isSample ? <SampleTag /> : <span />}
          <span className="text-caption font-medium text-muted-foreground tabular-nums">
            {t.list.distance(distance)}
          </span>
        </span>
      </Link>
    </li>
  );
});
