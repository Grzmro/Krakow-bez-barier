"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureFilter } from "@krakow-bez-barier/contracts";
import { Button, Switch, Toggle, ToggleGroup, useAnnounce } from "@krakow-bez-barier/ui";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { BottomPanel } from "@/components/kbb";
import { pl } from "@/i18n/pl";
import type { HomeCategory } from "@/i18n/pl/home";
import { config } from "@/lib/config";
import { distanceMeters } from "@/lib/place-features";
import { usePlaces } from "@/lib/places";
import { PlaceMap } from "./place-map";
import { PlaceRow } from "./place-list";
import { SearchBox } from "./search-box";

const t = pl.home;

const CATEGORIES: HomeCategory[] = ["all", "restaurant", "museum", "toilet", "hotel"];
const FEATURES: FeatureFilter[] = ["step_free", "lift", "toilet_accessible", "bench", "disabled_parking", "changing_table"];
const LIST_ID = "lista";
const MAP_PADDING = { top: 150, bottom: 100 };

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
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<HomeCategory>("all");
  const [features, setFeatures] = useState<FeatureFilter[]>([]);
  const [showUnknown, setShowUnknown] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLAnchorElement>());
  const listRef = useRef<HTMLDivElement>(null);

  const query = { q: useDebounced(q.trim()), category, features, includeUnknown: showUnknown };
  const places = usePlaces({
    q: query.q || undefined,
    category: category === "all" ? undefined : [category],
    feature: features.length ? features : undefined,
    includeUnknown: features.length ? showUnknown : undefined,
    limit: 100,
  });
  const items = useMemo(
    () =>
      (places.data?.items ?? [])
        .map((place) => ({ place, distance: distanceMeters(config.cityCenter, place.location.coordinates) }))
        .sort((a, b) => a.distance - b.distance),
    [places.data],
  );
  const mapPlaces = useMemo(() => items.map(({ place }) => place), [items]);
  const total = places.data?.total;
  const settled = query.q === q.trim() && !places.isPlaceholderData;
  const suggestions = useMemo(
    () => (settled && query.q ? [...new Set(items.map(({ place }) => place.name))] : []),
    [items, settled, query.q],
  );

  const queryKey = JSON.stringify(query);
  const pending = places.isPlaceholderData || total === undefined;
  useEffect(() => {
    if (!pending && total !== undefined) announce(t.list.announce(total));
  }, [announce, pending, total, queryKey]);

  function toggleFeature(feature: FeatureFilter) {
    setFeatures((current) =>
      current.includes(feature) ? current.filter((f) => f !== feature) : FEATURES.filter((f) => f === feature || current.includes(f)),
    );
    if (features.length === 1 && features[0] === feature) setShowUnknown(false);
  }

  function searchWider() {
    setQ("");
    setCategory("all");
    setFeatures([]);
    setShowUnknown(false);
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
          onValueChange={(value) => value[0] && setCategory(value[0] as HomeCategory)}
          className="no-scrollbar pointer-events-auto mx-auto mt-1.5 max-w-xl overflow-x-auto px-4 py-1.5"
        >
          {CATEGORIES.map((c) => (
            <Toggle key={c} value={c} className="shadow-soft">
              {t.categories[c]}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>

      <div className="absolute inset-x-0 top-0 bottom-[calc(50%-24px)]">
        <PlaceMap places={mapPlaces}selectedId={selectedId} onSelect={selectFromMap} padding={MAP_PADDING} />
      </div>

      <BottomPanel
        label={t.list.label}
        expanded={expanded}
        onExpandedChange={setExpanded}
        collapsedHeight="50%"
        className="mx-auto max-w-xl pb-[env(safe-area-inset-bottom)]"
      >
        <div className="space-y-2 px-4 pt-1 pb-2">
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
            {total === undefined ? t.list.loading : t.list.results(total)}
          </h2>
          {places.isError ? (
            <div className="grid justify-items-start gap-3">
              <p className="text-body">{t.list.error}</p>
              <Button variant="outline" onClick={() => places.refetch()}>
                {t.list.retry}
              </Button>
            </div>
          ) : total === 0 ? (
            <div className="grid place-items-center gap-3 py-8 text-center">
              <span className="grid size-16 place-items-center rounded-full bg-primary-container text-primary">
                <MagnifyingGlass weight="bold" className="size-8" aria-hidden />
              </span>
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
            </div>
          ) : (
            <ul className="space-y-2.5">
              {items.map(({ place, distance }) => (
                <PlaceRow
                  distance={distance}
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
    </main>
  );
}
