"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowsDownUp, CaretDown, CaretLeft, CaretRight, CloudSlash, NavigationArrow, Train, WarningCircle } from "@phosphor-icons/react";
import type { AccessibilityFact, Place, Route, RouteSegment } from "@krakow-bez-barier/contracts";
import { Button, buttonVariants, cn, StatusIcon, toast, Toggle, ToggleGroup, useAnnounce, type Status } from "@krakow-bez-barier/ui";
import { BottomPanel, FactRow, StatusBadge } from "@/components/kbb";
import { ProfileSwitch } from "@/components/profile/profile-switch";
import { RouteMap } from "@/components/route/route-map";
import { pl } from "@/i18n/pl";
import { config } from "@/lib/config";
import { factViews, formatDate, formatValue, joinValue } from "@/lib/place-facts";
import { usePlace } from "@/lib/places";
import { useProfile } from "@/lib/profile/use-profile";
import { routes } from "@/lib/routes";
import { RouteError, routeRequest, useRoute, type RouteKind } from "@/lib/use-route";

const t = pl.route;

const KINDS: RouteKind[] = ["avoid_stairs", "shortest"];
const KIND_LABEL: Record<RouteKind, string> = { avoid_stairs: t.avoidStairs, shortest: t.shortest };
const MAP_PADDING = { top: 190, bottom: 80 };

// Entrance facts from the destination's card: what the route ends at.
const ENTRANCE = new Set(["step_count", "threshold_cm", "door_width_cm", "ramp"]);

const BAR: Record<Status, string> = {
  met: "bg-status-met",
  barrier: "bg-status-barrier",
  conflict: "bg-status-conflict",
  unknown: "stripes-unknown",
};

const STEP_DOT: Record<Status, string> = {
  met: "bg-status-met-bg",
  barrier: "bg-status-barrier-bg",
  conflict: "bg-status-conflict-bg",
  unknown: "border-[1.5px] border-dashed border-status-unknown bg-status-unknown-bg",
};

const STATUS_TEXT: Record<Status, string> = {
  met: "text-muted-foreground",
  barrier: "text-status-barrier",
  conflict: "text-status-conflict",
  unknown: "text-status-unknown",
};

const barrierList = (route: Route) =>
  [...new Set(route.segments.filter((s) => s.state === "barrier").map((s) => s.note).filter(Boolean))].join(", ");

function summary(route: Route) {
  if (route.fallback) return `${t.noneOk}. ${t.alternative} ${barrierList(route)}. ${t.unknownOn(route.unknownSegmentCount, route.unknownMeters)}.`;
  if (route.knownBarrierCount === 0) return `${t.noKnown}, ${t.unknownOn(route.unknownSegmentCount, route.unknownMeters)}.`;
  return `${t.hasBarriers(barrierList(route))}. ${t.unknownOn(route.unknownSegmentCount, route.unknownMeters)}.`;
}

export function RouteScreen({ to }: { to?: string }) {
  const announce = useAnnounce();
  const { settings, setProfile } = useProfile();
  const profile = settings.profile;
  const [kind, setKind] = useState<RouteKind>("avoid_stairs");
  const [swapped, setSwapped] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const place = usePlace(to ?? "", {}, { enabled: Boolean(to) });
  const placeEnd = place.data?.location.coordinates as [number, number] | undefined;
  const end = to ? placeEnd : config.routeEnd;
  const endName = to ? (place.data?.name ?? "…") : t.places.rynek;
  const ends = end ? (swapped ? { from: end, to: config.routeStart } : { from: config.routeStart, to: end }) : null;
  const names = swapped ? [endName, t.places.dworzec] : [t.places.dworzec, endName];

  const avoid = useRoute(ends ? routeRequest(ends.from, ends.to, "avoid_stairs", settings) : null);
  const shortest = useRoute(ends ? routeRequest(ends.from, ends.to, "shortest", settings) : null);
  const current = kind === "avoid_stairs" ? avoid : shortest;
  const other = kind === "avoid_stairs" ? shortest : avoid;
  const route = current.data;

  useEffect(() => {
    if (route) announce(summary(route));
  }, [announce, route]);
  useEffect(() => {
    if (current.error) announce(current.error instanceof RouteError && current.error.reason === "no_route" ? t.error.noRoute : t.error.unavailable);
  }, [announce, current.error]);

  const switchKind = (next: RouteKind) => {
    setKind(next);
    setSelected(null);
  };

  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative mb-[calc(-1*env(safe-area-inset-bottom))] min-h-[640px] flex-1 overflow-hidden outline-none"
    >
      <div className="absolute inset-x-0 top-0 bottom-[calc(55%-24px)]">
        <RouteMap route={route} selected={selected} onSelect={setSelected} padding={MAP_PADDING} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-3">
        <div className="pointer-events-auto mx-auto flex max-w-xl items-start gap-2">
          <Link
            href={to ? routes.place(to) : routes.home}
            aria-label={t.back}
            className={cn(buttonVariants({ variant: "outline", size: "icon" }), "mt-1 shrink-0 border-0 shadow-float")}
          >
            <CaretLeft weight="bold" />
          </Link>
          <div className="relative min-w-0 flex-1 rounded-[20px] bg-card p-1 shadow-float">
            <p className="flex h-12 items-center gap-3 px-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-ink-foreground">
                <Train weight="bold" className="size-4" aria-hidden />
              </span>
              <span className="sr-only">{t.from}: </span>
              <span className="truncate text-body font-semibold">{names[0]}</span>
            </p>
            <span aria-hidden className="ml-[26px] block h-px w-[calc(100%-80px)] bg-border" />
            <p className="flex h-12 items-center gap-3 px-3">
              <span aria-hidden className="grid size-7 shrink-0 place-items-center">
                <span className="size-3.5 rounded-full bg-primary ring-4 ring-primary/20" />
              </span>
              <span className="sr-only">{t.to}: </span>
              <span className="truncate pr-12 text-body font-semibold">{names[1]}</span>
            </p>
            <Button
              variant="secondary"
              size="icon"
              aria-label={t.swap}
              onClick={() => {
                setSwapped((s) => !s);
                setSelected(null);
              }}
              className="absolute top-1/2 right-2 size-10 -translate-y-1/2"
            >
              <ArrowsDownUp weight="bold" />
            </Button>
          </div>
        </div>
        <ToggleGroup
          aria-label={t.kind}
          value={[kind]}
          onValueChange={(value) => value[0] && switchKind(value[0] as RouteKind)}
          className="pointer-events-auto mx-auto mt-3 max-w-xl pl-14"
        >
          {KINDS.map((k) => (
            <Toggle key={k} value={k} className="shadow-soft">
              {KIND_LABEL[k]}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>

      <BottomPanel
        label={t.segments}
        expanded={expanded}
        onExpandedChange={setExpanded}
        collapsedHeight="55%"
        className="mx-auto max-w-xl pb-[env(safe-area-inset-bottom)]"
        footer={
          <div className="shrink-0 border-t border-border bg-card/95 px-4 pt-3 pb-4 backdrop-blur">
            <Button size="lg" className="w-full" disabled={!route} onClick={() => toast(t.goSoon, { duration: 3000 })}>
              <NavigationArrow weight="fill" />
              {t.go}
            </Button>
          </div>
        }
      >
        <div className="px-4 pt-1 pb-6">
          <h1 className="font-display">
            {route ? (
              <>
                <span className="sr-only">{t.headingAria(route.durationMinutes, route.distanceMeters)}</span>
                <span aria-hidden>
                  <span className="text-h1 font-extrabold tabular-nums">{t.minutes(route.durationMinutes)}</span>
                  <span className="ml-2 text-title font-semibold text-muted-foreground">· {t.distance(route.distanceMeters)}</span>
                </span>
              </>
            ) : (
              <span className="text-h1 font-extrabold">{t.pageTitle}</span>
            )}
          </h1>
          <ProfileSwitch value={profile} onChange={setProfile} className="mt-3" />
          <p className="mt-1.5 text-caption text-muted-foreground">{profile ? t.profileOn(profile) : t.profileOff}</p>

          {to && place.isError ? (
            <p className="mt-4 text-body font-semibold">{t.error.noPlace}</p>
          ) : current.isPending ? (
            <p className="mt-4 text-body text-muted-foreground">{t.loading}</p>
          ) : current.isError ? (
            <div className="mt-4 flex gap-3 rounded-[20px] bg-status-conflict-bg p-4">
              <CloudSlash weight="bold" className="mt-0.5 size-6 shrink-0 text-status-conflict" aria-hidden />
              <div className="grid justify-items-start gap-3">
                <p className="text-body font-semibold">
                  {current.error instanceof RouteError && current.error.reason === "no_route" ? t.error.noRoute : t.error.unavailable}
                </p>
                <Button variant="outline" size="sm" onClick={() => current.refetch()}>
                  {t.error.retry}
                </Button>
              </div>
            </div>
          ) : route ? (
            <RouteDetails
              route={route}
              other={other.data}
              selected={selected}
              onSelect={setSelected}
              onSwitch={() => switchKind(kind === "avoid_stairs" ? "shortest" : "avoid_stairs")}
              noProfile={!profile}
            />
          ) : null}
          {to && place.data ? <Destination place={place.data} /> : null}
        </div>
      </BottomPanel>
    </main>
  );
}

function RouteDetails({
  route,
  other,
  selected,
  onSelect,
  onSwitch,
  noProfile,
}: {
  route: Route;
  other: Route | undefined;
  selected: number | null;
  onSelect: (id: number | null) => void;
  onSwitch: () => void;
  noProfile: boolean;
}) {
  const clean = route.knownBarrierCount === 0;
  const unknown = t.unknownOn(route.unknownSegmentCount, route.unknownMeters);
  const total = route.segments.length;

  return (
    <>
      <div className={cn("mt-3 rounded-[20px] p-4", clean ? "bg-status-met-bg" : "bg-status-barrier-bg")}>
        {route.fallback ? (
          <>
            <p className="flex items-center gap-2 text-body font-semibold text-status-barrier">
              <WarningCircle weight="fill" className="size-5 shrink-0" aria-hidden />
              {noProfile ? t.noneOkNoProfile : t.noneOk}
            </p>
            <p className="mt-1 pl-7 text-body-sm">
              {t.alternative} <strong>{barrierList(route)}</strong>
            </p>
            <p className="mt-0.5 pl-7 text-caption text-muted-foreground">{unknown}</p>
          </>
        ) : clean ? (
          <>
            <p className="flex items-center gap-2 text-body font-semibold text-status-met">
              <StatusIcon status="met" className="size-5" />
              {t.noKnown}
            </p>
            <p className="mt-1 pl-7 text-body-sm font-semibold text-status-unknown">{unknown}</p>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-body font-semibold text-status-barrier">
              <StatusIcon status="barrier" className="size-5" />
              {t.hasBarriers(barrierList(route))}
            </p>
            <p className="mt-0.5 pl-7 text-caption text-muted-foreground">{unknown}</p>
          </>
        )}
      </div>

      <div aria-hidden className="mt-3 flex h-8 items-center gap-[3px]">
        {route.segments.map((segment) => (
          <span
            key={segment.id}
            className={cn(
              "h-3 rounded-full transition-[height,opacity] duration-200",
              BAR[segment.state],
              selected !== null && selected !== segment.id && "opacity-35",
              selected === segment.id && "h-4",
            )}
            style={{ flexGrow: segment.lengthMeters, flexBasis: 0, minWidth: 4 }}
          />
        ))}
      </div>
      <p className="text-caption text-muted-foreground">{t.segmentsHint}</p>

      {other && other.kind !== route.kind ? (
        <button
          type="button"
          onClick={onSwitch}
          className="press mt-3 flex w-full items-center gap-3 rounded-[20px] bg-surface-raised p-3.5 text-left shadow-soft ring-1 ring-border/70"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold">
              {KIND_LABEL[other.kind]} <span className="font-normal text-muted-foreground">· {t.minutes(other.durationMinutes)}</span>
            </span>
            <span className="mt-1.5 block">
              {other.knownBarrierCount ? (
                <StatusBadge status="barrier" reason={barrierList(other)} />
              ) : (
                <StatusBadge
                  status={other.unknownSegmentCount ? "unknown" : "met"}
                  reason={t.unknownOn(other.unknownSegmentCount, other.unknownMeters)}
                />
              )}
            </span>
          </span>
          <CaretRight className="size-5 text-muted-foreground" aria-hidden />
        </button>
      ) : null}

      <h2 className="mt-7 mb-1 text-title font-semibold">{t.steps}</h2>
      <ol aria-label={t.stepsAria}>
        {route.segments.map((segment, index) => (
          <SegmentItem
            key={segment.id}
            segment={segment}
            index={index}
            total={total}
            open={selected === segment.id}
            onToggle={() => onSelect(selected === segment.id ? null : segment.id)}
          />
        ))}
      </ol>

      {route.attribution ? (
        <p className="mt-6 text-caption text-muted-foreground">
          {t.attribution}: {route.attribution}
        </p>
      ) : null}
    </>
  );
}

function factLine(fact: AccessibilityFact) {
  return `${pl.common.attribute[fact.attribute]}: ${joinValue(formatValue(fact.attribute, fact.value))}`;
}

function SegmentItem({
  segment,
  index,
  total,
  open,
  onToggle,
}: {
  segment: RouteSegment;
  index: number;
  total: number;
  open: boolean;
  onToggle: () => void;
}) {
  const status = segment.state;
  const last = index === total - 1;
  const detailsId = `odcinek-${segment.id}`;
  const line = [segment.name, `${pl.common.status[status]}${segment.note ? `: ${segment.note}` : ""}`].filter(Boolean).join(" · ");
  return (
    <li className="relative flex gap-3">
      <div className="flex w-9 shrink-0 flex-col items-center pt-3">
        <span className={cn("grid size-9 place-items-center rounded-full", STEP_DOT[status])}>
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
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={t.segmentAria(index + 1, total, segment.instruction, segment.lengthMeters, pl.common.status[status], segment.note ?? "")}
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
          <CaretDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        <div id={detailsId} hidden={!open} className="px-3 pt-1 pb-2">
          {segment.facts.length ? (
            <ul className="space-y-1.5">
              {segment.facts.map((fact) => (
                <li key={fact.id} className="text-caption">
                  <span className="font-semibold text-foreground">{factLine(fact)}</span>
                  <span className="block text-muted-foreground">
                    {t.sourceLine(fact.source.name, formatDate(fact.fetchedAt))} · {pl.place.level[fact.reliability]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-caption text-muted-foreground">{t.nobody}</p>
          )}
        </div>
      </div>
    </li>
  );
}

function Destination({ place }: { place: Place }) {
  const facts = factViews(place).filter((f) => ENTRANCE.has(f.attribute));
  return (
    <section aria-labelledby="route-destination" className="mt-6">
      <h2 id="route-destination" className="text-title font-semibold">
        {t.destination.title} · {place.name}
      </h2>
      <p className="mt-0.5 mb-2 text-caption text-muted-foreground">{t.destination.hint}</p>
      <ul className="divide-y divide-border overflow-hidden rounded-[20px] bg-surface-raised shadow-soft ring-1 ring-border">
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
      <Link href={routes.place(place.id)} className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-10 px-0")}>
        {t.destination.open}
      </Link>
    </section>
  );
}
