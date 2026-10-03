"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { FeatureFilter } from "@krakow-bez-barier/contracts";
import { Button, cn, LabeledSwitch, StatusIcon, Switch, Toggle, ToggleGroup, useAnnounce, type Status } from "@krakow-bez-barier/ui";
import { CaretLeft, MagnifyingGlass, SlidersHorizontal } from "@phosphor-icons/react";
import { BottomPanel } from "@/components/kbb";
import { ProfileSwitch } from "@/components/profile/profile-switch";
import { ThresholdsDrawer } from "@/components/profile/thresholds-drawer";
import { useMessages } from "@/i18n/client";
import { useCategories } from "@/lib/categories";
import { config } from "@/lib/config";
import { byDistance, listCentre, searchArea, toLonLat, type NearbyOrigin } from "@/lib/nearby";
import { listedCount } from "@/lib/list-count";
import { onHomeReset, registerBackHandler } from "@/lib/back-navigation";
import { LIST_PAGE, nextWindow, windowFor } from "@/lib/list-window";
import { usePlaces } from "@/lib/places";
import { profileQuery } from "@/lib/profile/thresholds";
import { useProfile } from "@/lib/profile/use-profile";
import { countByStatus, filterByVerdict, missingNeeds, STATUS_ORDER } from "@/lib/profile/verdict-list";
import { scrollIntoViewWithin, scrollParent } from "@/lib/scroll-within";
import { useDebounced } from "@/lib/use-debounced";
import { useMediaQuery } from "@/lib/use-media-query";
import { useSessionFlag } from "@/lib/use-session-flag";
import { PlaceMap } from "./place-map";
import { NearbyToggle } from "./nearby-toggle";
import { PlaceRow } from "./place-list";
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
// Waits for the panel to stop moving (a swipe, the height transition) before the map's padding follows it.
const INSET_SETTLE_MS = 120;
// The attribution and zoom buttons ride just above the panel (never above its half height: see `followPanel`).
const CONTROLS_ABOVE_PANEL = "bottom-[calc(var(--panel-inset,0px)+0.75rem)] lg:bottom-9";
const STOWED_KEY = "kbb-list-stowed";
const STOWED_HEIGHT = "calc(4.5rem + env(safe-area-inset-bottom))";
// Set on <main> as --list-collapsed: half the screen, but on a short phone (browser toolbars) down to 40%,
// so ~20rem stays for the map and its overlays. The map's padding and controls stop at the same value.
const COLLAPSED_HEIGHT = "var(--list-collapsed)";
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
  const position = nearby?.position ?? null;
  const chosenPlace = nearby?.place;
  const rowRefs = useRef(new Map<string, HTMLAnchorElement>());
  const listRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const focusRowRef = useRef<string | null>(null);
  const desktop = useMediaQuery(DESKTOP);
  const stowed = stowedFlag && !desktop;
  const mainRef = useRef<HTMLElement>(null);
  const collapsedRef = useRef<HTMLDivElement>(null);
  const [panelInset, setPanelInset] = useState(0);
  const insetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const insetKnown = useRef(false);
  useEffect(() => () => clearTimeout(insetTimer.current), []);

  // Every frame of a swipe or transition: the map controls follow the panel at once (CSS variable, no render);
  // the map's padding follows once the panel has settled.
  function followPanel(height: number) {
    const main = mainRef.current;
    const probe = collapsedRef.current;
    if (!main || !probe) return;
    // The probe is not rendered on desktop, where the panel is a column beside the map, not over it.
    const collapsed = probe.getClientRects().length ? probe.getBoundingClientRect().height : 0;
    const inset = Math.round(Math.min(height, collapsed));
    main.style.setProperty("--panel-inset", `${inset}px`);
    clearTimeout(insetTimer.current);
    // The first height is taken at once: the map fits the places to it as soon as it loads.
    if (!insetKnown.current) {
      insetKnown.current = true;
      setPanelInset(inset);
    } else insetTimer.current = setTimeout(() => setPanelInset(inset), INSET_SETTLE_MS);
  }

  const area = position ? searchArea(position) : undefined;
  const query = { q: useDebounced(q.trim()), category, features, includeUnknown: showUnknown, area };
  const places = usePlaces({
    bbox: area,
    // TODO(KBB-88): load places for the map viewport; until then the map shows the 100 nearest the Rynek.
    near: listCentre(position),
    q: query.q || undefined,
    category: category === ALL ? undefined : [category],
    feature: features.length ? features : undefined,
    includeUnknown: features.length ? showUnknown : undefined,
    limit: 100,
    ...profileQuery(settings),
  });
  const origin = useMemo(() => (position ? toLonLat(position) : null), [position]);
  const items = useMemo(() => byDistance(places.data?.items ?? [], origin ?? config.cityCenter), [places.data, origin]);
  const counts = useMemo(() => countByStatus(items), [items]);
  const shown = useMemo(() => filterByVerdict(items, { status: statusFilter, hideFailing }), [items, statusFilter, hideFailing]);
  const mapPlaces = useMemo(() => shown.map(({ place }) => place), [shown]);
  const total = places.data?.total;
  // The API returns only the nearest page: near me of the area, otherwise of the whole city around the Rynek.
  const cutNote =
    places.data?.nextCursor && total !== undefined
      ? (origin ? tn.nearestOnly : tn.nearestRynekOnly)(places.data.items.length, total)
      : null;
  const verdicts = Boolean(profile && items.some(({ place }) => place.verdict));
  const verdictCount = items.filter(({ place }) => place.verdict).length;
  const missing = useMemo(() => (verdicts && counts.met === 0 ? missingNeeds(items).slice(0, 3) : []), [verdicts, counts.met, items]);
  const settled = query.q === q.trim() && !places.isPlaceholderData;
  const suggestions = useMemo(
    () => (settled && query.q ? [...new Set(items.map(({ place }) => place.name))] : []),
    [items, settled, query.q],
  );

  const resultsLabel = total === undefined ? t.list.loading : t.list.results(listedCount(places.data!, shown.length));
  const queryKey = JSON.stringify(query);
  // The list renders a window of rows that grows by a page; a new search or verdict filter starts it over.
  const windowKey = `${queryKey}|${statusFilter}|${hideFailing}`;
  const [listWindow, setListWindow] = useState({ key: windowKey, rendered: LIST_PAGE });
  const rendered = listWindow.key === windowKey ? listWindow.rendered : LIST_PAGE;
  const rows = useMemo(() => shown.slice(0, rendered), [shown, rendered]);
  const growWindow = (size: (current: number) => number) =>
    setListWindow((current) => ({ key: windowKey, rendered: size(current.key === windowKey ? current.rendered : LIST_PAGE) }));
  const pending = places.isPlaceholderData || total === undefined;
  const listAnnouncement =
    total === undefined ? null : verdicts && profile ? tp.announce(profile, shown.length, items.length, counts) : t.list.announce(listedCount(places.data!, shown.length));
  const announcement =
    listAnnouncement &&
    [origin ? (chosenPlace ? tn.announceChosen(chosenPlace) : tn.announce) : null, listAnnouncement, cutNote].filter(Boolean).join(". ");
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

  function searchWider() {
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
          <SearchBox value={q} onValueChange={setQ} suggestions={suggestions} />
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
        collapsedHeight={COLLAPSED_HEIGHT}
        stowed={stowed}
        onStowedChange={setStowed}
        stowLabels={t.list.stow}
        stowedSummary={resultsLabel}
        stowedHeight={STOWED_HEIGHT}
        onHeightChange={followPanel}
        headerClassName="lg:hidden"
        className="mx-auto max-w-xl pb-[env(safe-area-inset-bottom)] lg:static lg:col-start-1 lg:row-start-2 lg:mx-0 lg:h-auto! lg:max-w-none lg:rounded-none lg:border-r lg:border-border lg:pb-0 lg:shadow-none"
      >
        <div className="space-y-2 px-4 pt-1 pb-2">
          <ProfileSwitch value={profile} onChange={changeProfile} />
          <NearbyToggle origin={nearby} onChange={setNearby} />
          {profile ? (
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

        <div ref={listRef} id={LIST_ID} tabIndex={-1} className="scroll-mt-2 px-4 pt-1 pb-8 outline-none">
          <h2 className="mb-2 text-caption font-semibold text-muted-foreground">
            {resultsLabel}
          </h2>
          {cutNote ? <p className="mb-2 text-body-sm text-muted-foreground">{cutNote}</p> : null}
          {places.isError ? (
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
          you={origin}
          youLabel={chosenPlace}
        />
      </div>
      <ThresholdsDrawer open={thresholdsOpen} onOpenChange={setThresholdsOpen} />
    </main>
  );
}
