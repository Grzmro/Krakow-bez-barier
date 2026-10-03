"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureFilter } from "@krakow-bez-barier/contracts";
import { Button, cn, LabeledSwitch, StatusIcon, Switch, Toggle, ToggleGroup, useAnnounce, type Status } from "@krakow-bez-barier/ui";
import { MagnifyingGlass, SlidersHorizontal } from "@phosphor-icons/react";
import { BottomPanel } from "@/components/kbb";
import { ProfileSwitch } from "@/components/profile/profile-switch";
import { ThresholdsDrawer } from "@/components/profile/thresholds-drawer";
import { pl } from "@/i18n/pl";
import { useCategories } from "@/lib/categories";
import { config } from "@/lib/config";
import type { DevicePosition } from "@/lib/native/geolocation";
import { byDistance, searchArea, toLonLat } from "@/lib/nearby";
import { usePlaces } from "@/lib/places";
import { profileQuery } from "@/lib/profile/thresholds";
import { useProfile } from "@/lib/profile/use-profile";
import { countByStatus, filterByVerdict, STATUS_ORDER } from "@/lib/profile/verdict-list";
import { PlaceMap } from "./place-map";
import { NearbyToggle } from "./nearby-toggle";
import { PlaceRow } from "./place-list";
import { SearchBox } from "./search-box";

const t = pl.home;
const tp = pl.profile;
const tn = pl.nearby.home;

const ALL = "all";
const FEATURES: FeatureFilter[] = ["step_free", "lift", "toilet_accessible", "bench", "disabled_parking", "changing_table"];
const LIST_ID = "lista";
const MAP_PADDING = { top: 150, bottom: 100 };

const COUNTER_PRESSED: Record<Status, string> = {
  met: "aria-pressed:bg-status-met-bg aria-pressed:ring-status-met",
  barrier: "aria-pressed:bg-status-barrier-bg aria-pressed:ring-status-barrier",
  conflict: "aria-pressed:bg-status-conflict-bg aria-pressed:ring-status-conflict",
  unknown: "aria-pressed:bg-status-unknown-bg aria-pressed:ring-status-unknown",
};

function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function HomeScreen() {
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
  // Stays in this component: only the coarse `searchArea` goes to the API (see docs/architecture.md).
  const [position, setPosition] = useState<DevicePosition | null>(null);
  const rowRefs = useRef(new Map<string, HTMLAnchorElement>());
  const listRef = useRef<HTMLDivElement>(null);

  const area = position ? searchArea(position) : undefined;
  const query = { q: useDebounced(q.trim()), category, features, includeUnknown: showUnknown, area };
  const places = usePlaces({
    bbox: area,
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
  const verdicts = Boolean(profile && items.some(({ place }) => place.verdict));
  const settled = query.q === q.trim() && !places.isPlaceholderData;
  const suggestions = useMemo(
    () => (settled && query.q ? [...new Set(items.map(({ place }) => place.name))] : []),
    [items, settled, query.q],
  );

  const queryKey = JSON.stringify(query);
  const pending = places.isPlaceholderData || total === undefined;
  const listAnnouncement =
    total === undefined ? null : verdicts && profile ? tp.announce(profile, shown.length, items.length, counts) : t.list.announce(total);
  const announcement = listAnnouncement && origin ? `${tn.announce}. ${listAnnouncement}` : listAnnouncement;
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
    setPosition(null);
    setQ("");
    setCategory(ALL);
    setFeatures([]);
    setShowUnknown(false);
    setStatusFilter(null);
    setHideFailing(false);
  }

  function selectFromMap(id: string) {
    setSelectedId(id);
    const row = rowRefs.current.get(id);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    row?.focus({ preventScroll: true });
  }

  return (
    // Full bleed: cancel the body's bottom safe-area padding so the map and sheet reach the screen edge;
    // the sheet pads its own content instead.
    <main
      id="main"
      tabIndex={-1}
      className="relative mb-[calc(-1*env(safe-area-inset-bottom))] min-h-[600px] flex-1 overflow-hidden outline-none"
    >
      <h1 className="sr-only">{t.title}</h1>
      <a
        href={`#${LIST_ID}`}
        onClick={(event) => {
          event.preventDefault();
          listRef.current?.focus();
        }}
        className="sr-only z-50 rounded-full bg-ink px-4 py-3 font-semibold text-ink-foreground focus:not-sr-only focus:absolute focus:top-3 focus:left-4"
      >
        {t.skipToList}
      </a>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 pt-3">
        <div className="pointer-events-auto mx-auto flex max-w-xl px-4">
          <SearchBox value={q} onValueChange={setQ} suggestions={suggestions} />
        </div>
        <ToggleGroup
          aria-label={t.categoriesLabel}
          value={[category]}
          onValueChange={(value) => value[0] && setCategory(value[0])}
          className="no-scrollbar pointer-events-auto mx-auto mt-1.5 max-w-xl overflow-x-auto px-4 py-1.5"
        >
          <Toggle value={ALL} className="shadow-soft">
            {t.categoryAll}
          </Toggle>
          {categories.data?.map((c) => (
            <Toggle key={c.id} value={c.id} className="shadow-soft">
              {c.label}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>

      <div className="absolute inset-x-0 top-0 bottom-[calc(50%-24px)]">
        <PlaceMap places={mapPlaces} selectedId={selectedId} onSelect={selectFromMap} padding={MAP_PADDING} you={origin} />
      </div>

      <BottomPanel
        label={t.list.label}
        expanded={expanded}
        onExpandedChange={setExpanded}
        collapsedHeight="50%"
        className="mx-auto max-w-xl pb-[env(safe-area-inset-bottom)]"
      >
        <div className="space-y-2 px-4 pt-1 pb-2">
          <ProfileSwitch value={profile} onChange={changeProfile} />
          <NearbyToggle active={Boolean(position)} onChange={setPosition} />
          {profile ? (
            <>
              <div className="flex items-center gap-2">
                <div role="group" aria-label={tp.countersLabel} className="flex min-w-0 items-center gap-2">
                  {STATUS_ORDER.map((status) => (
                    <Toggle
                      key={status}
                      pressed={statusFilter === status}
                      onPressedChange={() => toggleStatus(status)}
                      aria-label={tp.counter(counts[status], pl.common.status[status])}
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
            </>
          ) : null}
          <div role="group" aria-label={t.filtersLabel} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1.5">
            {FEATURES.map((feature) => (
              <Toggle key={feature} pressed={features.includes(feature)} onPressedChange={() => toggleFeature(feature)}>
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
            {total === undefined ? t.list.loading : t.list.results(shown.length === items.length ? total : shown.length)}
          </h2>
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
              {shown.map(({ place, distance }) => (
                <PlaceRow
                  distance={distance}
                  fromUser={Boolean(origin)}
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
        </div>
      </BottomPanel>
      <ThresholdsDrawer open={thresholdsOpen} onOpenChange={setThresholdsOpen} />
    </main>
  );
}
