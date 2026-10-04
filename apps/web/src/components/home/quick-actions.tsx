"use client";

import { useId } from "react";
import Link from "next/link";
import { NavigationArrow } from "@phosphor-icons/react";
import type { PlaceSummary } from "@krakow-bez-barier/contracts";
import { buttonVariants, cn, Toggle } from "@krakow-bez-barier/ui";
import { FactRow, SampleTag, StatusBadge } from "@/components/kbb";
import { FEATURE_ATTRIBUTES } from "@/domain/features";
import { useLocale, useMessages } from "@/i18n/client";
import { categoryIcon } from "@/lib/categories";
import type { DistanceFrom } from "@/lib/nearby";
import { factViews } from "@/lib/place-facts";
import { summaryLine } from "@/lib/place-features";
import { usePlace } from "@/lib/places";
import { profileQuery } from "@/lib/profile/thresholds";
import { useProfile } from "@/lib/profile/use-profile";
import { QUICK_ACTIONS, type QuickAction, type QuickActionId } from "@/lib/quick-actions";
import { routes } from "@/lib/routes";
import { chipFallback } from "./place-list";

/** The row of quick actions ("Najbliższa toaleta", …), drawn from `QUICK_ACTIONS`. */
export function QuickActionRow({
  active,
  onRun,
  className,
}: {
  active: QuickActionId | null;
  onRun: (action: QuickAction) => void;
  className?: string;
}) {
  const t = useMessages().home.quick;
  return (
    <div role="group" aria-label={t.label} className={cn("flex gap-2", className)}>
      {(QUICK_ACTIONS as readonly QuickAction[]).map((action) => {
        const I = categoryIcon(action.icon);
        const label = t.actions[action.id].label;
        return (
          <Toggle
            key={action.id}
            pressed={active === action.id}
            onPressedChange={() => onRun(action)}
            className="h-11 shrink-0 gap-1.5 px-4 lg:h-8 lg:px-3 lg:text-[13px]"
          >
            <I weight="bold" className="size-5 lg:size-4" aria-hidden />
            {label}
          </Toggle>
        );
      })}
    </div>
  );
}

export type QuickResultState =
  | { kind: "needLocation" }
  | { kind: "searching" }
  | { kind: "none" }
  | { kind: "found"; place: PlaceSummary; distance: number; from: DistanceFrom };

/** What a quick action found: the nearest place meeting its filters by known data, with the facts behind it. */
export function QuickResult({ action, state }: { action: QuickAction; state: QuickResultState }) {
  const m = useMessages();
  const t = m.home.quick;
  const headingId = useId();
  const title = t.actions[action.id].result;
  return (
    <section
      aria-labelledby={headingId}
      data-quick-result={state.kind}
      className="rounded-[20px] bg-surface-raised p-3 shadow-soft ring-2 ring-primary"
    >
      <h2 id={headingId} className="text-caption font-semibold text-muted-foreground">
        {title}
      </h2>
      {state.kind === "found" ? (
        <FoundPlace action={action} place={state.place} distance={state.distance} from={state.from} />
      ) : state.kind === "none" ? (
        <div className="mt-1 space-y-1 text-body-sm">
          <p className="font-semibold">{t.none(title)}</p>
          <p className="text-muted-foreground">{t.noneHint}</p>
        </div>
      ) : (
        <p className="mt-1 text-body-sm">{state.kind === "needLocation" ? t.needLocation : t.searching}</p>
      )}
    </section>
  );
}

function FoundPlace({ action, place, distance, from }: { action: QuickAction; place: PlaceSummary; distance: number; from: DistanceFrom }) {
  const m = useMessages();
  const t = m.home.quick;
  const locale = useLocale();
  const { settings } = useProfile();
  const detail = usePlace(place.id, profileQuery(settings));
  const attributes = new Set(action.features.flatMap((feature) => FEATURE_ATTRIBUTES[feature]));
  // Without a filter (nearest stop) the whole card is the answer, unknown rows included, since none of it is a pass.
  const facts = detail.data
    ? factViews(detail.data, locale).filter((fact) => (attributes.size ? attributes.has(fact.attribute) && !fact.unknown : true))
    : [];
  const verdict = place.verdict;
  return (
    <div className="mt-1 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {verdict ? (
            <StatusBadge
              status={verdict.state}
              reason={verdict.state === "met" ? undefined : verdict.reasons[0]}
              unconfirmed={verdict.unconfirmed}
              className="mb-1 max-w-full"
            />
          ) : null}
          <p className="text-[17px] leading-6 font-semibold">{place.name}</p>
          <p className="text-caption font-medium text-muted-foreground tabular-nums">{m.home.list.distance(distance, from)}</p>
        </div>
        {place.isSample ? <SampleTag /> : null}
      </div>
      {detail.isPending ? (
        <p className="text-caption text-muted-foreground">{t.loadingFacts}</p>
      ) : detail.data === null ? (
        // A place known only from the list (no card): its summary is all we can show.
        <p className="text-caption leading-[18px] font-medium text-foreground/80">{summaryLine(place.summary, (chip) => chipFallback(chip, m.common))}</p>
      ) : facts.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl ring-1 ring-border">
          {facts.map((fact) => (
            <FactRow
              key={fact.attribute}
              label={fact.label}
              value={fact.value}
              unit={fact.unit}
              reliability={fact.reliability}
              sources={fact.sources}
            />
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link href={routes.route(place.id)} className={buttonVariants({ size: "sm" })}>
          <NavigationArrow weight="fill" aria-hidden />
          {t.guide}
        </Link>
        <Link href={routes.place(place.id)} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {t.details}
        </Link>
      </div>
    </div>
  );
}
