"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { FeatureFilter } from "@krakow-bez-barier/contracts";
import { Button, buttonVariants, cn, LabeledSwitch, StatusIcon, Switch, Toggle, ToggleGroup, useAnnounce, type Status } from "@krakow-bez-barier/ui";
import { CaretLeft, MagnifyingGlass, SlidersHorizontal } from "@phosphor-icons/react";
import { BottomPanel } from "@/components/kbb";
import { CONTROLS_ABOVE_PANEL, STOWED_HEIGHT, usePanelInset } from "@/components/map/use-panel-inset";
import { ProfileSwitch } from "@/components/profile/profile-switch";
import { ThresholdsDrawer } from "@/components/profile/thresholds-drawer";
import { useMessages } from "@/i18n/client";
import { useCategories } from "@/lib/categories";
import { config } from "@/lib/config";
import { routes } from "@/lib/routes";
import { routeTarget } from "@/lib/route-intent";
import { byDistance, type NearbyOrigin } from "@/lib/nearby";
import { homeView, PEEK_LIMIT, searchOrigin } from "@/lib/home-start";
import { listedCount } from "@/lib/list-count";
import { parseNearestCommand } from "@/lib/nearest-command";
import { onHomeReset, registerBackHandler } from "@/lib/back-navigation";
import { LIST_PAGE, nextWindow, windowFor } from "@/lib/list-window";
import { usePlaces } from "@/lib/places";
import { nearestMatch, QUICK_ACTIONS, quickFilters, quickStillApplies, type QuickAction, type QuickActionId } from "@/lib/quick-actions";
import { profileQuery } from "@/lib/profile/thresholds";
import { useProfile } from "@/lib/profile/use-profile";
import { countByStatus, filterByVerdict, missingNeeds, STATUS_ORDER } from "@/lib/profile/verdict-list";
import { scrollIntoViewWithin, scrollParent } from "@/lib/scroll-within";
import { useDebounced } from "@/lib/use-debounced";
import { useGrantedPosition } from "@/lib/use-granted-position";
import { useMediaQuery } from "@/lib/use-media-query";
import { useSessionFlag } from "@/lib/use-session-flag";
import { PlaceMap } from "./place-map";
import { NearbyToggle, type NearbyToggleHandle } from "./nearby-toggle";
import { PlaceRow } from "./place-list";
import { QuickActionRow, QuickResult, type QuickResultState } from "./quick-actions";
import { SEARCH_INPUT_ID, SearchBox } from "./search-box";

const ALL = "all";
const FEATURES: FeatureFilter[] = ["step_free", "lift", "toilet_accessible", "bench", "disabled_parking", "changing_table"];
const LIST_ID = "lista";
// One chip look for categories and feature filters; the scroll rows fade out at the right edge on a phone.
const CHIP = "lg:h-8 lg:px-3 lg:text-[13px]";
const CHIP_ROW = "no-scrollbar overflow-x-auto py-1.5 pr-10 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] lg:flex-wrap lg:overflow-visible lg:pr-4 lg:[mask-image:none]";
// Mobile: the map fills the screen; search and chips float over its top, the panel over its bottom (added as
// `inset`), and the bottom value keeps the pins off the strip with the attribution above the panel.
// Desktop: the map has the right column to itself.
const MAP_PADDING = { top: 150, bottom: 64 };
const MAP_PADDING_DESKTOP = { top: 48, bottom: 48 };
const STOWED_KEY = "kbb-list-stowed";
// Set on <main> as --list-collapsed: half the screen, but on a short phone (browser toolbars) down to 40%,
// so ~20rem stays for the map and its overlays. The map's padding and controls stop at the same value.
const COLLAPSED_HEIGHT = "var(--list-collapsed)";
// The start peek: the grabber, the quick actions and the first nearest place; the rest is a drag or a button away.
const PEEK_HEIGHT = "calc(14.5rem + env(safe-area-inset-bottom))";
const NO_HIGHLIGHT = () => {};
const DESKTOP = "(min-width: 64rem)";

const COUNTER_PRESSED: Record<Status, string> = {
  met: "aria-pressed:bg-status-met-bg aria-pressed:ring-status-met",
  barrier: "aria-pressed:bg-status-barrier-bg aria-pressed:ring-status-barrier",
  conflict: "aria-pressed:bg-status-conflict-bg aria-pressed:ring-status-conflict",
  unknown: "aria-pressed:bg-status-unknown-bg aria-pressed:ring-status-unknown",
};

export function HomeScreen() {
  const m = useMessages();
  const t = m.home;
  const tp = m.profile;
  const tn = m.nearby.home;
  const announce = useAnnounce();
  const { settings, setProfile } = useProfile();
  const profile = settings.profile;
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);
  const [hideFailing, setHideFailing] = useState(false);
  const [thresholdsOpen, setThresholdsOpen] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const categories = useCategories();
  const [features, setFeatures] = useState<FeatureFilter[]>([]);
  const [showUnknown, setShowUnknown] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stowedFlag, setStowed] = useSessionFlag(STOWED_KEY);
  const revealRef = useRef<string | null>(null);
  // Stays in this component: only the coarse `searchArea` goes to the API (see docs/architecture.md).
  const [nearby, setNearby] = useState<NearbyOrigin | null>(null);
  const chosenPlace = nearby?.place;
  const nearbyRef = useRef<NearbyToggleHandle>(null);
  const [quickId, setQuickId] = useState<QuickActionId | null>(null);
  const [unknownCommand, setUnknownCommand] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLAnchorElement>());
  const listRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const focusRowRef = useRef<string | null>(null);
  const desktop = useMediaQuery(DESKTOP);
  const stowed = stowedFlag && !desktop;
  const mainRef = useRef<HTMLElement>(null);
  const collapsedRef = useRef<HTMLDivElement>(null);
  const { inset: panelInset, follow: followPanel } = usePanelInset(mainRef, collapsedRef);

  // Start state: a clean map and a partly slid out panel peeking the nearest places. Results (list and pins)
  // load only once something was asked; clearing the search returns to the start.
  const peekNearby = useGrantedPosition();
  const peekFrom = useMemo(() => searchOrigin(peekNearby, config.cityCenter), [peekNearby]);
  const view = homeView({ q, category: category === ALL ? null : category, features, nearby }, peekFrom);
  const searching = view.searching;
  // A user's own "hide" is kept only within one state: the peek and the results each come back slid out.
  const wasSearching = useRef(searching);
  useEffect(() => {
    if (wasSearching.current !== searching) setStowed(false);
    wasSearching.current = searching;
  }, [searching, setStowed]);
  const peekQuery = usePlaces(
    {
      bbox: peekFrom.area,
      near: peekFrom.centre,
      limit: PEEK_LIMIT,
      ...profileQuery(settings),
    },
    { enabled: !searching },
  );
  const peekItems = useMemo(
    () => byDistance(peekQuery.data?.items ?? [], peekFrom.from ?? config.cityCenter).slice(0, PEEK_LIMIT),
    [peekQuery.data, peekFrom],
  );
  const searchFrom = useMemo(() => searchOrigin(nearby, config.cityCenter), [nearby]);
  const area = searchFrom.area;
  const query = { q: useDebounced(q.trim()), category, features, includeUnknown: showUnknown, area };
  const placesQuery = usePlaces(
    {
      bbox: area,
      // TODO(KBB-88): load places for the map viewport; until then the map shows the 100 nearest the Rynek.
      near: searchFrom.centre,
      q: query.q || undefined,
      category: category === ALL ? undefined : [category],
      feature: features.length ? features : undefined,
      includeUnknown: features.length ? showUnknown : undefined,
      limit: 100,
      ...profileQuery(settings),
    },
    { enabled: searching },
  );
  // Keep-previous-data would otherwise leave the last results standing after the search is cleared.
  const places = {
    data: searching ? placesQuery.data : undefined,
    isError: searching && placesQuery.isError,
    isPlaceholderData: searching && placesQuery.isPlaceholderData,
    refetch: placesQuery.refetch,
  };
  const origin = searchFrom.from;
  const items = useMemo(() => byDistance(places.data?.items ?? [], origin ?? config.cityCenter), [places.data, origin]);
  const counts = useMemo(() => countByStatus(items), [items]);
  const shown = useMemo(() => filterByVerdict(items, { status: statusFilter, hideFailing }), [items, statusFilter, hideFailing]);
  const mapPlaces = useMemo(() => shown.map(({ place }) => place), [shown]);
  const total = places.data?.total;
  // A quick action stays on while the list still shows its filters; changing them by hand ends it.
  const quick =
    (QUICK_ACTIONS as readonly QuickAction[]).find(
      (action) =>
        action.id === quickId &&
        (action.unavailable || quickStillApplies(action, { category: category === ALL ? null : category, features })),
    ) ?? null;
  // The API returns only the nearest page: near me of the area, otherwise of the whole city around the Rynek.
  const cutNote =
    places.data?.nextCursor && total !== undefined
      ? (origin ? tn.nearestOnly : tn.nearestRynekOnly)(places.data.items.length, total)
      : null;
  const verdicts = Boolean(profile && items.some(({ place }) => place.verdict));
  const verdictCount = items.filter(({ place }) => place.verdict).length;
  const missing = useMemo(() => (verdicts && counts.met === 0 ? missingNeeds(items).slice(0, 3) : []), [verdicts, counts.met, items]);
  const settled = query.q === q.trim() && !places.isPlaceholderData;
  const routeTo = useMemo(
    () =>
      settled && !places.isError ? routeTarget(q, shown.map(({ place }) => place)) : null,
    [settled, places.isError, q, shown],
  );
  const suggestions = useMemo(
    () => (settled && query.q ? [...new Set(items.map(({ place }) => place.name))] : []),
    [items, settled, query.q],
  );

  const resultsLabel = !searching ? t.list.start[view.heading] : total === undefined ? t.list.loading : t.list.results(listedCount(places.data!, shown.length));
  const queryKey = JSON.stringify(query);
  // The list renders a window of rows that grows by a page; a new search or verdict filter starts it over.
  const windowKey = `${queryKey}|${statusFilter}|${hideFailing}`;
  const [listWindow, setListWindow] = useState({ key: windowKey, rendered: LIST_PAGE });
  const rendered = listWindow.key === windowKey ? listWindow.rendered : LIST_PAGE;
  const rows = useMemo(() => shown.slice(0, rendered), [shown, rendered]);
  const growWindow = (size: (current: number) => number) =>
    setListWindow((current) => ({ key: windowKey, rendered: size(current.key === windowKey ? current.rendered : LIST_PAGE) }));
  const pending = places.isPlaceholderData || total === undefined;
  const quickState = useMemo((): QuickResultState | null => {
    if (!quick) return null;
    if (quick.unavailable) return { kind: "unavailable" };
    if (!origin) return { kind: "needLocation" };
    if (pending || places.isError) return { kind: "searching" };
    const nearest = nearestMatch(items, quick.features);
    return nearest ? { kind: "found", ...nearest, from: chosenPlace ? "chosen" : "user" } : { kind: "none" };
  }, [quick, origin, pending, places.isError, items, chosenPlace]);
  const quickAnnouncement = quick
    ? quickState?.kind === "found"
      ? t.quick.found(t.quick.actions[quick.id].result, quickState.place.name, t.list.distance(quickState.distance, quickState.from))
      : quickState?.kind === "none"
        ? t.quick.none(t.quick.actions[quick.id].result)
        : null
    : null;
  const listAnnouncement =
    total === undefined ? null : verdicts && profile ? tp.announce(profile, shown.length, items.length, counts) : t.list.announce(listedCount(places.data!, shown.length));
  const announcement =
    listAnnouncement &&
    [quickAnnouncement, origin ? (chosenPlace ? tn.announceChosen(chosenPlace) : tn.announce) : null, listAnnouncement, cutNote]
      .filter(Boolean)
      .join(". ");
  useEffect(() => {
    if (!pending && announcement) announce(announcement);
  }, [announce, pending, announcement, queryKey]);

  function changeProfile(next: typeof profile) {
    if (next !== profile) setStatusFilter(null);
    if (!next) setHideFailing(false);
    setProfile(next);
  }

  function toggleStatus(status: Status) {
    setStatusFilter((current) => (current === status ? null : status));
    if (status === "barrier") setHideFailing(false);
  }

  function changeHideFailing(hide: boolean) {
    setHideFailing(hide);
    if (hide && statusFilter === "barrier") setStatusFilter(null);
  }

  function toggleFeature(feature: FeatureFilter) {
    setFeatures((current) =>
      current.includes(feature) ? current.filter((f) => f !== feature) : FEATURES.filter((f) => f === feature || current.includes(f)),
    );
    if (features.length === 1 && features[0] === feature) setShowUnknown(false);
  }

  function startQuick(action: QuickAction) {
    setQuickId(action.id);
    if (action.unavailable) return;
    const filters = quickFilters(action);
    setQ("");
    setCategory(filters.category ?? ALL);
    setFeatures(filters.features);
    setShowUnknown(false);
    setStatusFilter(null);
    setHideFailing(false);
    if (!nearby) nearbyRef.current?.locate();
  }

  function runQuick(action: QuickAction) {
    if (quick?.id !== action.id) return startQuick(action);
    setQuickId(null);
    if (!action.unavailable) {
      setCategory(ALL);
      setFeatures([]);
      setShowUnknown(false);
    }
  }

  // "najbliższa toaleta" (said or typed): the matching quick action, or just the category with "W mojej
  // okolicy" on; true when `text` was such a command. It never toggles an action off.
  function runCommand(text: string) {
    const parsed = parseNearestCommand(text, categories.data ?? []);
    setUnknownCommand(parsed?.kind === "unknown");
    if (!parsed) return false;
    if (parsed.kind === "unknown") {
      announce(`${t.command.unknownTitle} ${t.command.unknownHint}`);
      return true;
    }
    const { quick: quickAction, category: id } = parsed.command;
    if (quickAction) {
      if (quick?.id === quickAction.id) {
        if (!nearby) nearbyRef.current?.locate();
      } else startQuick(quickAction);
      return true;
    }
    setQuickId(null);
    setQ("");
    setCategory(id ?? ALL);
    setFeatures([]);
    setShowUnknown(false);
    setStatusFilter(null);
    setHideFailing(false);
    announce(t.command.applied(categories.data?.find((c) => c.id === id)?.label ?? ""));
    if (!nearby) nearbyRef.current?.locate();
    return true;
  }

  function searchWider() {
    setQuickId(null);
    setUnknownCommand(false);
    setNearby(null);
    setQ("");
    setCategory(ALL);
    setFeatures([]);
    setShowUnknown(false);
    setStatusFilter(null);
    setHideFailing(false);
  }

  // Anything that hides part of the city from the map and list; "back" undoes all of it at once.
  const narrowed = Boolean(q || category !== ALL || features.length || nearby || statusFilter || hideFailing);

  function resetView() {
    searchWider();
    setSelectedId(null);
    setExpanded(false);
  }

  const back = useEffectEvent(() => {
    if (expanded) setExpanded(false);
    else if (narrowed) resetView();
    else return false;
    return true;
  });
  const resetFromLogo = useEffectEvent(resetView);
  useEffect(() => registerBackHandler(back), []);
  useEffect(() => onHomeReset(resetFromLogo), []);

  function reveal(id: string) {
    if (id === LIST_ID) {
      listRef.current?.focus();
      return;
    }
    const row = rowRefs.current.get(id);
    if (row) scrollIntoViewWithin(row);
    row?.focus({ preventScroll: true });
  }

  function selectFromMap(id: string) {
    setSelectedId(id);
    const needed = windowFor(shown.findIndex(({ place }) => place.id === id), rendered);
    if (stowed || needed !== rendered) {
      revealRef.current = id;
      if (needed !== rendered) growWindow(() => needed);
      if (stowed) setStowed(false);
    } else reveal(id);
  }

  function showMore() {
    focusRowRef.current = shown[rendered]?.place.id ?? null;
    growWindow((current) => nextWindow(current, shown.length));
  }

  useEffect(() => {
    if (!stowed && revealRef.current) {
      reveal(revealRef.current);
      revealRef.current = null;
    }
    // "Pokaż więcej" moves focus to the first new row, so a keyboard user carries on where the list grew.
    if (focusRowRef.current) reveal(focusRowRef.current);
    focusRowRef.current = null;
  }, [stowed, rendered]);

  // Scrolling near the end of the list renders the next page, so nobody has to press the button.
  const hasMore = rendered < shown.length;
  const shownCount = shown.length;
  useEffect(() => {
    const more = moreRef.current;
    if (!more || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setListWindow((current) => ({
          key: windowKey,
          rendered: nextWindow(current.key === windowKey ? current.rendered : LIST_PAGE, shownCount),
        }));
      },
      { root: scrollParent(more), rootMargin: "0px 0px 400px 0px" },
    );
    observer.observe(more);
    return () => observer.disconnect();
  }, [hasMore, windowKey, shownCount, rendered]);

  const controls = (
    <div key="controls" className="space-y-2 px-4 pb-2">
      <ProfileSwitch value={profile} onChange={changeProfile} />
      <NearbyToggle ref={nearbyRef} origin={nearby} onChange={setNearby} />
      {unknownCommand ? (
        <div role="note" className="space-y-1 rounded-2xl border border-border bg-card px-3 py-2.5 text-body-sm">
          <p className="font-semibold">{t.command.unknownTitle}</p>
          <p>{t.command.unknownHint}</p>
        </div>
      ) : null}
      {profile && searching ? (
        <>
          <div className="flex items-center gap-2">
            <div role="group" aria-label={tp.countersLabel} className="flex min-w-0 items-center gap-2">
              {STATUS_ORDER.map((status) => (
                <Toggle
                  key={status}
                  pressed={statusFilter === status}
                  onPressedChange={() => toggleStatus(status)}
                  aria-label={tp.counter(counts[status], m.common.status[status])}
                  className={cn("h-11 min-w-0 gap-1.5 px-3 aria-pressed:ring-2", COUNTER_PRESSED[status])}
                >
                  <StatusIcon status={status} className="size-5!" />
                  <span className="font-num text-[17px] text-foreground">{counts[status]}</span>
                </Toggle>
              ))}
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label={tp.settings}
              onClick={() => setThresholdsOpen(true)}
              className="ml-auto size-11 shrink-0"
            >
              <SlidersHorizontal weight="bold" />
            </Button>
          </div>
          <LabeledSwitch label={tp.hideFailing} checked={hideFailing} onCheckedChange={changeHideFailing} className="-my-1" />
          {missing.length && !pending ? (
            <div role="note" className="space-y-1 rounded-2xl border border-border bg-card px-3 py-2.5 text-body-sm">
              <p className="font-semibold">{tp.list.noneMet.title}</p>
              <p>{tp.list.noneMet.missing(missing, verdictCount)}</p>
              <p className="text-muted-foreground">{tp.list.noneMet.hint}</p>
            </div>
          ) : null}
        </>
      ) : null}
      <div role="group" aria-label={t.filtersLabel} className={cn(CHIP_ROW, "-mx-4 flex gap-2 pl-4")}>
        {FEATURES.map((feature) => (
          <Toggle key={feature} pressed={features.includes(feature)} onPressedChange={() => toggleFeature(feature)} className={CHIP}>
            {t.filters[feature]}
          </Toggle>
        ))}
      </div>
      {features.length ? (
        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 text-body-sm font-semibold">
          <span>{t.showUnknown}</span>
          <Switch checked={showUnknown} onCheckedChange={setShowUnknown} />
        </label>
      ) : null}
    </div>
  );
  const listBlock = (
    <div key="list" ref={listRef} id={LIST_ID} tabIndex={-1} className="scroll-mt-2 px-4 pt-1 pb-8 outline-none">
      <h2 className="mb-2 text-caption font-semibold text-muted-foreground">
        {resultsLabel}
      </h2>
      {cutNote ? <p className="mb-2 text-body-sm text-muted-foreground">{cutNote}</p> : null}
      {routeTo ? (
        <div role="group" aria-label={t.search.route.button} className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-primary-container px-4 py-3">
          <p className="min-w-0 flex-1 text-body-sm font-semibold">{t.search.route.prompt(routeTo.name)}</p>
          <Link href={routes.route(routeTo.id)} aria-label={t.search.route.aria(routeTo.name)} className={buttonVariants()}>
            {t.search.route.button}
          </Link>
        </div>
      ) : null}
      {!searching ? (
        <>
          {peekQuery.isError ? (
            <div className="grid justify-items-start gap-3">
              <p className="text-body">{t.list.error}</p>
              <Button variant="outline" onClick={() => peekQuery.refetch()}>
                {t.list.retry}
              </Button>
            </div>
          ) : !peekQuery.data ? (
            <p role="status" className="text-body-sm text-muted-foreground">
              {t.list.loading}
            </p>
          ) : peekItems.length ? (
            <ul className="space-y-2.5">
              {peekItems.map(({ place, distance }) => (
                <PlaceRow
                  key={place.id}
                  place={place}
                  distance={distance}
                  from={peekFrom.source === "map" ? "centre" : peekFrom.source}
                  features={[]}
                  selected={false}
                  onHighlight={NO_HIGHLIGHT}
                />
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-muted-foreground">{t.list.start.empty}</p>
          )}
          <p className="mt-3 text-body-sm text-muted-foreground">{t.list.start.hint}</p>
        </>
      ) : places.isError ? (
        <div className="grid justify-items-start gap-3">
          <p className="text-body">{t.list.error}</p>
          <Button variant="outline" onClick={() => places.refetch()}>
            {t.list.retry}
          </Button>
        </div>
      ) : total !== undefined && shown.length === 0 ? (
        <div className="grid place-items-center gap-3 py-8 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-primary-container text-primary">
            <MagnifyingGlass weight="bold" className="size-8" aria-hidden />
          </span>
          {items.length ? (
            <>
              <p className="text-title font-semibold">{tp.list.filteredEmpty}</p>
              <p className="text-body-sm text-muted-foreground">{tp.list.filteredEmptyHint}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter(null);
                  setHideFailing(false);
                }}
              >
                {tp.list.showAll}
              </Button>
            </>
          ) : (
            <>
              <p className="text-title font-semibold">{t.list.empty}</p>
              {origin ? (
                <p className="text-body-sm text-muted-foreground">
                  {chosenPlace ? tn.emptyHintChosen(chosenPlace) : tn.emptyHint}
                </p>
              ) : null}
              {features.length && !showUnknown ? (
                <p className="text-body-sm text-muted-foreground">
                  {t.list.noFeatureMatch(features.map((f) => t.filters[f]).join(", "))}
                </p>
              ) : null}
              {category === "transit_stop" || category === "parking" ? (
                <p className="text-body-sm text-muted-foreground">
                  {t.list.licenceHold[category]}{" "}
                  <Link href={routes.aboutData} className="font-semibold text-primary underline">
                    {t.list.licenceHold.link}
                  </Link>
                </p>
              ) : null}
              <p className="text-body-sm text-muted-foreground">{t.list.emptyHint}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={searchWider}>
                  {t.list.searchWider}
                </Button>
                {features.length && !showUnknown ? (
                  <Button variant="ghost" onClick={() => setShowUnknown(true)}>
                    {t.showUnknown}
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(({ place, distance }) => (
            <PlaceRow
              distance={distance}
              from={origin ? (chosenPlace ? "chosen" : "user") : "centre"}
              key={place.id}
              ref={(node) => {
                if (node) rowRefs.current.set(place.id, node);
                else rowRefs.current.delete(place.id);
              }}
              place={place}
              features={features}
              selected={place.id === selectedId}
              onHighlight={setSelectedId}
            />
          ))}
        </ul>
      )}
      {hasMore && !places.isError ? (
        <div ref={moreRef} className="pt-3">
          <Button variant="outline" className="w-full" onClick={showMore}>
            {t.list.more(rendered, shown.length)}
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    // Full bleed: cancel the body's bottom safe-area padding so the map and sheet reach the screen edge;
    // the sheet pads its own content instead.
    <main
      ref={mainRef}
      id="main"
      tabIndex={-1}
      data-fill-viewport
      className="relative mb-[calc(-1*env(safe-area-inset-bottom))] min-h-[22rem] [--list-collapsed:min(50%,max(40%,100%_-_20rem))] flex-1 overflow-hidden outline-none lg:mb-0 lg:grid lg:min-h-0 lg:grid-cols-[minmax(24rem,28rem)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]"
    >
      <h1 className="sr-only">{t.title}</h1>
      <a
        href={`#${LIST_ID}`}
        onClick={(event) => {
          event.preventDefault();
          if (stowed) {
            revealRef.current = LIST_ID;
            setStowed(false);
          } else listRef.current?.focus();
        }}
        className="sr-only z-50 rounded-full bg-ink px-4 py-3 font-semibold text-ink-foreground focus:not-sr-only focus:absolute focus:top-3 focus:left-4"
      >
        {t.skipToList}
      </a>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 pt-3 lg:pointer-events-auto lg:static lg:col-start-1 lg:row-start-1 lg:max-h-[45dvh] lg:overflow-y-auto lg:border-r lg:border-border lg:bg-card lg:pt-4">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 *:pointer-events-auto">
          {narrowed ? (
            <Button
              variant="outline"
              size="icon"
              aria-label={t.backToMap}
              onClick={() => {
                resetView();
                document.getElementById(SEARCH_INPUT_ID)?.focus();
              }}
              className="shrink-0 border-0 shadow-float lg:border lg:shadow-none"
            >
              <CaretLeft weight="bold" aria-hidden />
            </Button>
          ) : null}
          <SearchBox value={q} onValueChange={setQ} suggestions={suggestions} onCommand={runCommand} />
        </div>
        <ToggleGroup
          aria-label={t.categoriesLabel}
          value={[category]}
          onValueChange={(value) => value[0] && setCategory(value[0])}
          className={cn(CHIP_ROW, "mx-auto mt-1.5 max-w-xl pl-4")}
        >
          <Toggle value={ALL} className={cn("pointer-events-auto shadow-soft", CHIP)}>
            {t.categoryAll}
          </Toggle>
          {categories.data?.map((c) => (
            <Toggle key={c.id} value={c.id} className={cn("pointer-events-auto shadow-soft", CHIP)}>
              {c.label}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>

      <BottomPanel
        label={t.list.label}
        expanded={expanded}
        onExpandedChange={setExpanded}
        collapsedHeight={searching ? COLLAPSED_HEIGHT : PEEK_HEIGHT}
        stowed={stowed}
        onStowedChange={setStowed}
        stowLabels={t.list.stow}
        stowedSummary={searching ? resultsLabel : t.list.start.summary}
        stowedHeight={STOWED_HEIGHT}
        onHeightChange={followPanel}
        headerClassName="lg:hidden"
        className="mx-auto max-w-xl pb-[env(safe-area-inset-bottom)] lg:static lg:col-start-1 lg:row-start-2 lg:mx-0 lg:h-auto! lg:max-w-none lg:rounded-none lg:border-r lg:border-border lg:pb-0 lg:shadow-none"
      >
        <div className="space-y-2 px-4 pt-1 pb-2">
          <QuickActionRow active={quick?.id ?? null} onRun={runQuick} className={cn(CHIP_ROW, "-mx-4 pl-4")} />
          {quick && quickState ? <QuickResult action={quick} state={quickState} /> : null}
        </div>
        {searching ? [controls, listBlock] : [listBlock, controls]}
      </BottomPanel>
      {/* Resolves --list-collapsed in px: the map's padding and controls never rise above the half-height panel. */}
      <div ref={collapsedRef} aria-hidden className="pointer-events-none invisible absolute bottom-0 left-0 h-(--list-collapsed) w-px lg:hidden" />
      {/* Phone: the map fills the screen at every panel height and the panel lies over it, so it never resizes. */}
      <div className="absolute inset-0 lg:relative lg:inset-auto lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0">
        <PlaceMap
          places={mapPlaces}
          selectedId={selectedId}
          onSelect={selectFromMap}
          padding={desktop ? MAP_PADDING_DESKTOP : MAP_PADDING}
          inset={desktop ? 0 : panelInset}
          revealSelected={!desktop}
          controlsClassName={CONTROLS_ABOVE_PANEL}
          you={searching ? origin : peekFrom.from}
          youLabel={chosenPlace}
        />
      </div>
      <ThresholdsDrawer open={thresholdsOpen} onOpenChange={setThresholdsOpen} />
    </main>
  );
}
