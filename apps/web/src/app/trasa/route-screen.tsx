"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { ArrowsDownUp, CaretRight, CircleNotch, CloudSlash, MapPin, NavigationArrow, WarningCircle, X } from "@phosphor-icons/react";
import type { Place, Route } from "@krakow-bez-barier/contracts";
import { Button, buttonVariants, cn, StatusIcon, Toggle, ToggleGroup, useAnnounce, type Status } from "@krakow-bez-barier/ui";
import { BottomPanel, FactRow, StatusBadge } from "@/components/kbb";
import { BackButton } from "@/components/layout/back-button";
import { ProfileSwitch } from "@/components/profile/profile-switch";
import { RouteMap } from "@/components/route/route-map";
import { StartPicker, type StartOption, type StartPick } from "@/components/route/start-picker";
import { useLocale, useMessages } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import { config } from "@/lib/config";
import { locateDevice } from "@/lib/native/geolocation";
import { locationSettings } from "@/lib/native/platform";
import { locateFailureText, toLonLat } from "@/lib/nearby";
import { factViews } from "@/lib/place-facts";
import { usePlace } from "@/lib/places";
import type { ProfileSettings } from "@/lib/profile/thresholds";
import { useProfile } from "@/lib/profile/use-profile";
import { parseStart, startParam, STATION, type RouteStart } from "@/lib/route-start";
import { routes } from "@/lib/routes";
import { scrollIntoViewWithin } from "@/lib/scroll-within";
import { useMediaQuery } from "@/lib/use-media-query";
import { useGuidance } from "@/lib/use-guidance";
import { RouteError, routeRequest, useRoute, type RouteKind } from "@/lib/use-route";
import { NavigationFooter, RouteNavigation } from "./route-navigation";
import { StepList } from "./route-steps";

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

// Summary card: neutral, never green, while any segment lacks data.
const CARD: Record<Status, string> = {
  met: "bg-status-met-bg",
  barrier: "bg-status-barrier-bg",
  conflict: "bg-status-conflict-bg",
  unknown: "bg-status-unknown-bg",
};

const HEADLINE: Record<Status, string> = {
  met: "text-status-met",
  barrier: "text-status-barrier",
  conflict: "text-status-conflict",
  unknown: "text-foreground",
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

/** One state per route, the same wherever the route is shown: barriers, then conflicts, then missing data. */
function routeStatus(route: Route): Status {
  if (route.knownBarrierCount) return "barrier";
  if (route.segments.some((s) => s.state === "conflict")) return "conflict";
  return route.unknownSegmentCount ? "unknown" : "met";
}

/** Headline of a route without known barriers: green only when no segment lacks data. */
const cleanHeadline = (t: RouteMessages, route: Route) => (route.unknownSegmentCount ? t.noKnownGaps(route.unknownMeters) : t.noKnown);

function alternativeLine(t: RouteMessages, route: Route, limits: string) {
  return route.knownBarrierCount ? `${t.alternative} ${barrierList(route)}` : `${t.alternativeUnmet} ${limits}`;
}

function alternativeReason(t: RouteMessages, route: Route) {
  if (route.knownBarrierCount) return barrierList(route);
  return routeStatus(route) === "met" ? t.noKnown : gaps(t, route);
}

function summary(t: RouteMessages, route: Route, limits: string) {
  if (route.fallback) return `${t.noneOk}. ${alternativeLine(t, route, limits)}. ${gaps(t, route)}.`;
  if (route.knownBarrierCount === 0) return `${cleanHeadline(t, route)}. ${gaps(t, route)}.`;
  return `${t.hasBarriers(barrierList(route))}. ${gaps(t, route)}.`;
}

function routeReason(error: unknown) {
  return error instanceof RouteError ? error.reason : "unavailable";
}

function routeErrorText(t: Messages["route"], error: unknown): string {
  const reason = routeReason(error);
  return reason === "no_route" ? t.error.noRoute : reason === "not_configured" ? t.error.notConfigured : t.error.unavailable;
}

export function RouteScreen({ to, from }: { to?: string; from?: string }) {
  const messages = useMessages();
  const t = messages.route;
  const errorText = (error: unknown) => routeErrorText(t, error);
  const announce = useAnnounce();
  const { settings, setProfile } = useProfile();
  const profile = settings.profile;
  const [kind, setKind] = useState<RouteKind>("avoid_stairs");
  const [swapped, setSwapped] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  // Start of a route planned again from the walker's position while guiding.
  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const desktop = useMediaQuery(DESKTOP);
  const stepRefs = useRef(new Map<number, HTMLButtonElement>());

  const [chosenStart, setStart] = useState<RouteStart>(() => parseStart(from));
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<{ message: string; help: string | null } | null>(null);
  const locateRun = useRef(0);
  const startFieldId = useId();

  const place = usePlace(to ?? "", {}, { enabled: Boolean(to) });
  const placeEnd = place.data?.location.coordinates as [number, number] | undefined;
  const end = to ? placeEnd : config.routeEnd;
  const endName = to ? (place.data?.name ?? "…") : t.places.rynek;

  // A place start from a link carries only its id; its position and name come from the API.
  const startPlaceId = chosenStart.kind === "place" && !chosenStart.position ? chosenStart.id : "";
  const startPlace = usePlace(startPlaceId, {}, { enabled: Boolean(startPlaceId) });
  const startMissing = Boolean(startPlaceId) && startPlace.data === null;
  const start = startMissing ? STATION : chosenStart;
  const startPosition =
    start.kind === "station"
      ? config.routeStart
      : start.kind === "place"
        ? (start.position ?? (startPlace.data?.location.coordinates as [number, number] | undefined))
        : start.position;
  const startName =
    start.kind === "station"
      ? t.places.dworzec
      : start.kind === "me"
        ? t.start.me
        : start.kind === "point"
          ? t.start.point
          : (start.name ?? startPlace.data?.name ?? "…");
  const startOption: StartOption = {
    value: start.kind === "place" ? `place:${start.id}` : start.kind,
    label: startName,
    pick: start,
  };
  const startNotice = startMissing ? { message: t.start.notFound, help: null } : notice;

  const planned = end && startPosition ? (swapped ? { from: end, to: startPosition } : { from: startPosition, to: end }) : null;
  const ends = planned && origin ? { from: origin, to: planned.to } : planned;

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
    if (startMissing) announce(t.start.notFound);
  }, [announce, startMissing, t]);

  // The start goes into the link (a place id, or a position rounded to ~100 m), so the route can be shared.
  // Only `z` is rewritten, on the URL as it is now: the router owns the rest and may be mid-navigation.
  const startValue = startParam(start);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.pathname !== routes.route() || (url.searchParams.get("z") ?? undefined) === startValue) return;
    const to = url.searchParams.get("do") ?? undefined;
    window.history.replaceState(null, "", routes.route(to, startValue));
  }, [startValue]);

  const pickStart = async (next: StartPick) => {
    setOrigin(null);
    setSelected(null);
    const run = ++locateRun.current;
    if (next.kind !== "locate") {
      setLocating(false);
      setNotice(null);
      setStart(next);
      return;
    }
    setLocating(true);
    setNotice(null);
    announce(t.start.locating);
    const result = await locateDevice();
    if (run !== locateRun.current) return;
    setLocating(false);
    if (result.ok) {
      setStart({ kind: "me", position: toLonLat(result.position) });
      announce(t.start.located);
      return;
    }
    // No position: the route keeps its start and says why, with what to do about it.
    const { message, help } = locateFailureText(result.reason, locationSettings(), messages.nearby);
    const text = t.start.failed(message, startName);
    setNotice({ message: text, help });
    announce(help ? `${text} ${help}` : text);
  };

  const switchKind = (next: RouteKind) => {
    setKind(next);
    setSelected(null);
  };

  // A segment picked on the map opens its step in the list and moves focus there, so the list stays the way back.
  const selectFromMap = (id: number | null) => {
    setSelected(id);
    const step = id === null ? undefined : stepRefs.current.get(id);
    if (!step) return;
    scrollIntoViewWithin(step);
    step.focus({ preventScroll: true });
  };

  const guidance = useGuidance(route);
  const guiding = guidance.active;
  const guidanceHeading = useRef<HTMLHeadingElement>(null);
  const goButton = useRef<HTMLButtonElement>(null);
  const wasGuiding = useRef(false);
  // Focus follows the panel: into guidance when it starts, back to "Ruszamy" when it ends.
  useEffect(() => {
    if (guiding) guidanceHeading.current?.focus();
    else if (wasGuiding.current) {
      // Without a route (a failed new one) "Ruszamy" is disabled; the screen itself takes focus.
      const button = goButton.current;
      if (button && !button.disabled) button.focus();
      else document.getElementById("main")?.focus();
    }
    wasGuiding.current = guiding;
  }, [guiding]);

  const go = () => {
    setSelected(null);
    setExpanded(false);
    guidance.start();
  };
  const reroute = () => {
    if (!guidance.position) return;
    setSelected(null);
    setOrigin(guidance.position);
  };

  const startRow = (
    <div className="flex h-12 items-center gap-3 pr-12 pl-3">
      <StartPicker
        id={startFieldId}
        label={swapped ? t.to : t.from}
        current={startOption}
        onPick={pickStart}
        asDestination={swapped}
      />
    </div>
  );
  const endRow = (
    <p className="flex h-12 items-center gap-3 px-3">
      {swapped ? (
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-ink-foreground">
          <MapPin weight="bold" className="size-4" />
        </span>
      ) : (
        <span aria-hidden className="grid size-7 shrink-0 place-items-center">
          <span className="size-3.5 rounded-full bg-primary ring-4 ring-primary/20" />
        </span>
      )}
      <span className="sr-only">{swapped ? t.from : t.to}: </span>
      <span className="truncate pr-12 text-body font-semibold">{endName}</span>
    </p>
  );

  return (
    <main
      id="main"
      tabIndex={-1}
      data-desktop-fill
      className="relative mb-[calc(-1*env(safe-area-inset-bottom))] min-h-[640px] flex-1 overflow-hidden outline-none lg:mb-0 lg:grid lg:min-h-0 lg:grid-cols-[minmax(24rem,28rem)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-3 lg:pointer-events-auto lg:static lg:col-start-1 lg:row-start-1 lg:max-h-[45dvh] lg:overflow-y-auto lg:border-r lg:border-border lg:bg-card lg:pt-4">
        <div className="mx-auto flex max-w-xl items-start gap-2 *:pointer-events-auto">
          <BackButton
            label={t.back}
            fallback={to ? routes.place(to) : routes.home}
            className="mt-1 border-0 shadow-float lg:border lg:shadow-none"
          />
          <div className="relative min-w-0 flex-1 rounded-[20px] bg-card p-1 shadow-float lg:shadow-none lg:ring-1 lg:ring-border">
            {origin ? (
              <>
                <p className="flex h-12 items-center gap-3 px-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-ink-foreground">
                    <MapPin weight="bold" className="size-4" aria-hidden />
                  </span>
                  <span className="sr-only">{t.from}: </span>
                  <span className="truncate pr-12 text-body font-semibold">{t.nav.yourPosition}</span>
                </p>
                <span aria-hidden className="ml-[26px] block h-px w-[calc(100%-80px)] bg-border" />
                {swapped ? startRow : endRow}
              </>
            ) : (
              <>
                {swapped ? endRow : startRow}
                <span aria-hidden className="ml-[26px] block h-px w-[calc(100%-80px)] bg-border" />
                {swapped ? startRow : endRow}
              </>
            )}
            <Button
              variant="secondary"
              size="icon"
              aria-label={t.swap}
              onClick={() => {
                setSwapped((s) => !s);
                setOrigin(null);
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
            {guiding ? (
              <NavigationFooter guidance={guidance} total={route?.segments.length ?? 0} onEnd={guidance.end} />
            ) : (
              <Button ref={goButton} size="lg" className="w-full" disabled={!route} onClick={go}>
                <NavigationArrow weight="fill" />
                {t.go}
              </Button>
            )}
          </div>
        }
      >
        {guiding ? (
          <RouteNavigation
            route={route}
            guidance={guidance}
            loading={current.isPending}
            error={current.isError ? errorText(current.error) : null}
            selected={selected}
            onSelect={setSelected}
            onReroute={reroute}
            headingRef={guidanceHeading}
            stepRefs={stepRefs}
          />
        ) : (
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
          {locating ? (
            <p className="mt-3 flex items-center gap-2 text-body-sm text-muted-foreground">
              <CircleNotch weight="bold" className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
              {t.start.locating}
            </p>
          ) : startNotice ? (
            <div className="mt-3 flex gap-3 rounded-[20px] bg-status-conflict-bg p-4">
              <WarningCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-status-conflict" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold">{startNotice.message}</p>
                {startNotice.help ? (
                  <details className="mt-1 text-body-sm">
                    <summary className="cursor-pointer font-semibold text-primary underline-offset-2 hover:underline">{t.start.help}</summary>
                    <p className="mt-1">{startNotice.help}</p>
                  </details>
                ) : null}
              </div>
              {startMissing ? null : (
                <Button variant="ghost" size="icon" aria-label={t.start.dismiss} onClick={() => setNotice(null)} className="-mt-2 -mr-2 size-10 shrink-0">
                  <X weight="bold" />
                </Button>
              )}
            </div>
          ) : null}
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
                  <Link
                    href={routes.route()}
                    onClick={() => void pickStart(STATION)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
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
        )}
      </BottomPanel>

      <div className="absolute inset-x-0 top-0 bottom-[calc(55%-24px)] lg:relative lg:inset-auto lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0">
        <RouteMap
          route={route}
          selected={guiding && selected === null && route && guidance.progress ? (route.segments[guidance.progress.step]?.id ?? null) : selected}
          onSelect={selectFromMap}
          padding={desktop ? MAP_PADDING_DESKTOP : MAP_PADDING}
          you={guiding ? guidance.position : null}
          follow={guiding && guidance.follow}
        />
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
  const status = routeStatus(route);
  const clean = status !== "barrier";
  const unknown = gaps(t, route);
  const background = route.fallback ? "bg-status-barrier-bg" : CARD[status];

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
            <p className={cn("flex items-center gap-2 text-body font-semibold", HEADLINE[status])}>
              <StatusIcon status={status} className="size-5 shrink-0" />
              {cleanHeadline(t, route)}
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
              <StatusBadge status={routeStatus(other)} reason={alternativeReason(t, other)} />
            </span>
          </span>
          <CaretRight className="size-5 text-muted-foreground" aria-hidden />
        </button>
      ) : null}

      <h2 className="mt-7 mb-1 text-title font-semibold">{t.steps}</h2>
      <StepList route={route} selected={selected} onSelect={onSelect} stepRefs={stepRefs} />

      {route.attribution ? (
        <p className="mt-6 text-caption text-muted-foreground">
          {t.attribution}: {route.attribution}
        </p>
      ) : null}
    </>
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
