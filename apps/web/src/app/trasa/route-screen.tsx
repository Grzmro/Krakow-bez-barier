"use client";

import { useEffect, useRef, useState, type Ref, type RefObject } from "react";
import Link from "next/link";
import { ArrowsDownUp, CaretDown, CaretLeft, CaretRight, CloudSlash, NavigationArrow, Train, WarningCircle } from "@phosphor-icons/react";
import type { AccessibilityFact, Place, Route, RouteSegment } from "@krakow-bez-barier/contracts";
import { Button, buttonVariants, cn, StatusIcon, toast, Toggle, ToggleGroup, useAnnounce, type Status } from "@krakow-bez-barier/ui";
import { BottomPanel, FactRow, StatusBadge } from "@/components/kbb";
import { ProfileSwitch } from "@/components/profile/profile-switch";
import { RouteMap } from "@/components/route/route-map";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/locale";
import type { Messages } from "@/i18n/messages";
import { config } from "@/lib/config";
import { factViews, formatDate, formatValue, joinValue } from "@/lib/place-facts";
import { usePlace } from "@/lib/places";
import type { ProfileSettings } from "@/lib/profile/thresholds";
import { useProfile } from "@/lib/profile/use-profile";
import { routes } from "@/lib/routes";
import { scrollIntoViewWithin } from "@/lib/scroll-within";
import { useMediaQuery } from "@/lib/use-media-query";
import { RouteError, routeRequest, useRoute, type RouteKind } from "@/lib/use-route";

const KINDS: RouteKind[] = ["avoid_stairs", "shortest"];
// Mobile: the route card floats over the map and the sheet covers its lower half. Desktop: the map has the right column to itself.
const MAP_PADDING = { top: 190, bottom: 80 };
// Bottom: the attribution and zoom buttons sit there, and the destination dot must stay clear of them.
const MAP_PADDING_DESKTOP = { top: 48, bottom: 96 };
const DESKTOP = "(min-width: 64rem)";

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

type RouteMessages = Messages["route"];

const barrierList = (route: Route) =>
  [...new Set(route.segments.filter((s) => s.state === "barrier").map((s) => s.note).filter(Boolean))].join(", ");

/** What the alternative misses when it shows no known barrier: the request's own limits. */
const limitsOf = (t: RouteMessages, settings: ProfileSettings) => {
  const profile = settings.profile;
  if (!profile) return t.limitsNoProfile;
  const { maxThresholdCm, requireSmoothSurface } = settings.thresholds[profile];
  return t.limitsProfile(maxThresholdCm, requireSmoothSurface);
};

/** Segments without data and with conflicting data: neither counts as passable. */
function gaps(t: RouteMessages, route: Route) {
  const conflicts = route.segments.filter((s) => s.state === "conflict").length;
  return [t.unknownOn(route.unknownSegmentCount, route.unknownMeters), conflicts ? t.conflictOn(conflicts) : null].filter(Boolean).join(", ");
}

function alternativeLine(t: RouteMessages, route: Route, limits: string) {
  return route.knownBarrierCount ? `${t.alternative} ${barrierList(route)}` : `${t.alternativeUnmet} ${limits}`;
}

function summary(t: RouteMessages, route: Route, limits: string) {
  if (route.fallback) return `${t.noneOk}. ${alternativeLine(t, route, limits)}. ${gaps(t, route)}.`;
  if (route.knownBarrierCount === 0) return `${t.noKnown}, ${gaps(t, route)}.`;
  return `${t.hasBarriers(barrierList(route))}. ${gaps(t, route)}.`;
}

function routeReason(error: unknown) {
  return error instanceof RouteError ? error.reason : "unavailable";
}

function routeErrorText(t: Messages["route"], error: unknown): string {
  const reason = routeReason(error);
  return reason === "no_route" ? t.error.noRoute : reason === "not_configured" ? t.error.notConfigured : t.error.unavailable;
}

export function RouteScreen({ to }: { to?: string }) {
  const t = useMessages().route;
  const errorText = (error: unknown) => routeErrorText(t, error);
  const announce = useAnnounce();
  const { settings, setProfile } = useProfile();
  const profile = settings.profile;
  const [kind, setKind] = useState<RouteKind>("avoid_stairs");
  const [swapped, setSwapped] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [goNote, setGoNote] = useState(false);
  const desktop = useMediaQuery(DESKTOP);
  const stepRefs = useRef(new Map<number, HTMLButtonElement>());
  const revealRef = useRef<number | null>(null);

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
  const limits = limitsOf(t, settings);

  useEffect(() => {
    if (route) announce(summary(t, route, limits));
  }, [announce, route, limits, t]);
  useEffect(() => {
    if (current.error) announce(routeErrorText(t, current.error));
  }, [announce, current.error, t]);

  useEffect(() => {
    if (!goNote) return;
    const id = setTimeout(() => setGoNote(false), 4000);
    return () => clearTimeout(id);
  }, [goNote]);

  // A segment picked on the map opens its step in the list and moves focus there, so the list stays the way back.
  useEffect(() => {
    const id = revealRef.current;
    if (id === null || selected !== id) return;
    revealRef.current = null;
    const step = stepRefs.current.get(id);
    if (!step) return;
    scrollIntoViewWithin(step);
    step.focus({ preventScroll: true });
  }, [selected]);

  const switchKind = (next: RouteKind) => {
    setKind(next);
    setSelected(null);
  };

  const selectFromMap = (id: number | null) => {
    revealRef.current = id;
    setSelected(id);
  };

  const go = () => {
    // On desktop a bottom-centred toast would sit on the map's attribution links; the note stays next to the button.
    if (desktop) {
      setGoNote(true);
      announce(t.goSoon);
    } else toast(t.goSoon, { duration: 3000 });
  };

  return (
    <main
      id="main"
      tabIndex={-1}
      data-desktop-fill
      className="relative mb-[calc(-1*env(safe-area-inset-bottom))] min-h-[640px] flex-1 overflow-hidden outline-none lg:mb-0 lg:grid lg:min-h-0 lg:grid-cols-[minmax(24rem,28rem)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-3 lg:pointer-events-auto lg:static lg:col-start-1 lg:row-start-1 lg:border-r lg:border-border lg:bg-card lg:pt-4">
        <div className="mx-auto flex max-w-xl items-start gap-2 *:pointer-events-auto">
          <Link
            href={to ? routes.place(to) : routes.home}
            aria-label={t.back}
            className={cn(buttonVariants({ variant: "outline", size: "icon" }), "mt-1 shrink-0 border-0 shadow-float lg:border lg:shadow-none")}
          >
            <CaretLeft weight="bold" />
          </Link>
          <div className="relative min-w-0 flex-1 rounded-[20px] bg-card p-1 shadow-float lg:shadow-none lg:ring-1 lg:ring-border">
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
          className="mx-auto mt-3 max-w-xl pl-14 lg:pb-1"
        >
          {KINDS.map((k) => (
            <Toggle key={k} value={k} className="pointer-events-auto shadow-soft">
              {k === "avoid_stairs" ? t.avoidStairs : t.shortest}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>

      <BottomPanel
        label={t.segments}
        expanded={expanded}
        onExpandedChange={setExpanded}
        collapsedHeight="55%"
        headerClassName="lg:hidden"
        className="mx-auto max-w-xl pb-[env(safe-area-inset-bottom)] lg:static lg:col-start-1 lg:row-start-2 lg:mx-0 lg:h-auto! lg:max-w-none lg:rounded-none lg:border-r lg:border-border lg:pb-0 lg:shadow-none"
        footer={
          <div className="shrink-0 border-t border-border bg-card/95 px-4 pt-3 pb-4 backdrop-blur">
            {goNote ? <p className="mb-2 text-center text-body-sm text-muted-foreground">{t.goSoon}</p> : null}
            <Button size="lg" className="w-full" disabled={!route} onClick={go}>
              <NavigationArrow weight="fill" />
              {t.go}
            </Button>
          </div>
        }
      >
        <div className="px-4 pt-1 pb-6 lg:pt-4">
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
                <p className="text-body font-semibold">{errorText(current.error)}</p>
                {routeReason(current.error) === "not_configured" ? (
                  <Link href={routes.route()} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    {t.error.showExample}
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => current.refetch()}>
                    {t.error.retry}
                  </Button>
                )}
              </div>
            </div>
          ) : route ? (
            <RouteDetails
              route={route}
              other={other.data}
              selected={selected}
              onSelect={setSelected}
              stepRefs={stepRefs}
              onSwitch={() => switchKind(kind === "avoid_stairs" ? "shortest" : "avoid_stairs")}
              noProfile={!profile}
              limits={limits}
            />
          ) : null}
          {to && place.data ? <Destination place={place.data} /> : null}
        </div>
      </BottomPanel>

      <div className="absolute inset-x-0 top-0 bottom-[calc(55%-24px)] lg:relative lg:inset-auto lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0">
        <RouteMap route={route} selected={selected} onSelect={selectFromMap} padding={desktop ? MAP_PADDING_DESKTOP : MAP_PADDING} />
      </div>
    </main>
  );
}

function RouteDetails({
  route,
  other,
  selected,
  onSelect,
  stepRefs,
  onSwitch,
  noProfile,
  limits,
}: {
  route: Route;
  other: Route | undefined;
  selected: number | null;
  onSelect: (id: number | null) => void;
  stepRefs: RefObject<Map<number, HTMLButtonElement>>;
  onSwitch: () => void;
  noProfile: boolean;
  limits: string;
}) {
  const t = useMessages().route;
  const clean = route.knownBarrierCount === 0;
  const conflicted = route.segments.some((s) => s.state === "conflict");
  const unknown = gaps(t, route);
  const total = route.segments.length;
  const background = route.fallback || !clean ? "bg-status-barrier-bg" : conflicted ? "bg-status-conflict-bg" : "bg-status-met-bg";

  return (
    <>
      <div className={cn("mt-3 rounded-[20px] p-4", background)}>
        {route.fallback ? (
          <>
            <p className="flex items-center gap-2 text-body font-semibold text-status-barrier">
              <WarningCircle weight="fill" className="size-5 shrink-0" aria-hidden />
              {noProfile ? t.noneOkNoProfile : t.noneOk}
            </p>
            <p className="mt-1 pl-7 text-body-sm">
              {route.knownBarrierCount ? t.alternative : t.alternativeUnmet}{" "}
              <strong>{route.knownBarrierCount ? barrierList(route) : limits}</strong>
            </p>
            <p className="mt-0.5 pl-7 text-caption text-muted-foreground">{unknown}</p>
          </>
        ) : clean ? (
          <>
            <p className={cn("flex items-center gap-2 text-body font-semibold", conflicted ? "text-status-conflict" : "text-status-met")}>
              <StatusIcon status={conflicted ? "conflict" : "met"} className="size-5" />
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
              {other.kind === "avoid_stairs" ? t.avoidStairs : t.shortest} <span className="font-normal text-muted-foreground">· {t.minutes(other.durationMinutes)}</span>
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
            ref={(node) => {
              if (node) stepRefs.current.set(segment.id, node);
              else stepRefs.current.delete(segment.id);
            }}
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

function factLine(m: Messages, fact: AccessibilityFact, locale: Locale) {
  return `${m.common.attribute[fact.attribute]}: ${joinValue(formatValue(fact.attribute, fact.value, locale))}`;
}

function SegmentItem({
  segment,
  index,
  total,
  open,
  onToggle,
  ref,
}: {
  segment: RouteSegment;
  index: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  ref: Ref<HTMLButtonElement>;
}) {
  const m = useMessages();
  const t = m.route;
  const locale = useLocale();
  const status = segment.state;
  const last = index === total - 1;
  const detailsId = `odcinek-${segment.id}`;
  const line = [segment.name, `${m.common.status[status]}${segment.note ? `: ${segment.note}` : ""}`].filter(Boolean).join(" · ");
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
          ref={ref}
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={t.segmentAria(index + 1, total, segment.instruction, segment.lengthMeters, m.common.status[status], segment.note ?? "")}
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
    </li>
  );
}

function Destination({ place }: { place: Place }) {
  const t = useMessages().route;
  const facts = factViews(place, useLocale()).filter((f) => ENTRANCE.has(f.attribute));
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
