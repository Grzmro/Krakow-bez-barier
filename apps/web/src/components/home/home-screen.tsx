"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { FeatureFilter } from "@krakow-bez-barier/contracts";
import { Button, buttonVariants, cn, LabeledSwitch, StatusIcon, Switch, Toggle, ToggleGroup, useAnnounce, type Status } from "@krakow-bez-barier/ui";
import { CaretLeft, MagnifyingGlass, SlidersHorizontal } from "@phosphor-icons/react";
import { BottomPanel } from "@/components/kbb";
import { CONTROLS_ABOVE_PANEL, STOWED_HEIGHT, usePanelInset } from "@/components/map/use-panel-inset";
import { ProfileSwitch } from "@/components/profile/profile-switch";
import { ThresholdsDrawer } from "@/components/profile/thresholds-drawer";
import { useLocale, useMessages } from "@/i18n/client";
import { useCategories } from "@/lib/categories";
import { config } from "@/lib/config";
import { routes } from "@/lib/routes";
import { routeTarget } from "@/lib/route-intent";
import { byDistance, withDistance, type NearbyOrigin } from "@/lib/nearby";
import {
  choose,
  clearQuery,
  commitChange,
  confirmAction,
  draftAsk,
  escapeStep,
  FEATURE_FILTERS,
  type HomeChoices,
  type HomeCommitted,
  type HomeSelection,
  homeView,
  isSearching,
  panelAfterAsk,
  PEEK_LIMIT,
  runAsk,
  searchOrigin,
  showResults,
  START_SELECTION,
  widenSearch,
} from "@/lib/home-start";
import { committedToSearch, searchToCommitted, searchWantsNear } from "@/lib/home-url";
import { listedCount } from "@/lib/list-count";
import { matchCategories, parseNearestCommand } from "@/lib/nearest-command";
import { onHomeReset, registerBackHandler } from "@/lib/back-navigation";
import { LIST_PAGE, nextWindow, windowFor } from "@/lib/list-window";
import { nextPointsArea, type Bbox } from "@/lib/map-points";
import { useInfinitePlaces, usePlacePoints, usePlaces } from "@/lib/places";
import { QUICK_ACTIONS, quickAnnouncement, quickFilters, quickStillApplies, type QuickAction, type QuickActionId } from "@/lib/quick-actions";
import { profileQuery } from "@/lib/profile/thresholds";
import { useProfile } from "@/lib/profile/use-profile";
import { countByStatus, filterByVerdict, filterPointsByVerdict, missingNeeds, STATUS_ORDER } from "@/lib/profile/verdict-list";
import { scrollIntoViewWithin, scrollParent } from "@/lib/scroll-within";
import { useDebounced, useDebouncedValue } from "@/lib/use-debounced";
import { fitTargets, followedView, isPartial, listArea, nextTaggedView, pointsCut, roundView, type TaggedView } from "@/lib/view-list";
import { NEAR_SCOPE, POOR_RESULTS, type SearchScope, scopeArea, viewLeavesArea, viewScope, widerScope } from "@/lib/search-scope";
import { useGrantedPosition } from "@/lib/use-granted-position";
import { useMediaQuery } from "@/lib/use-media-query";
import { useSessionFlag } from "@/lib/use-session-flag";
import { PlaceMap } from "./place-map";
import { NearbyToggle, type NearbyToggleHandle } from "./nearby-toggle";
import { PlaceListSkeleton, PlaceRow } from "./place-list";
import { QuickActionRow, QuickResult, useQuickResult } from "./quick-actions";
import { SEARCH_INPUT_ID, SearchBox, type SearchSuggestion } from "./search-box";

const ALL = "all";
const FEATURES = FEATURE_FILTERS;
const LIST_ID = "lista";
const CONTROLS_ID = "filtry";
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
// Waits out a run of quick pans and zooms before loading points for where the map ended up.
const POINTS_DEBOUNCE_MS = 300;
// Waits out the debounce and the response of a pan before the list's new count is read out.
const ANNOUNCE_DELAY_MS = 600;
const SUGGESTION_LIMIT = 6;

const COUNTER_PRESSED: Record<Status, string> = {
  met: "aria-pressed:bg-status-met-bg aria-pressed:ring-status-met",
  barrier: "aria-pressed:bg-status-barrier-bg aria-pressed:ring-status-barrier",
  conflict: "aria-pressed:bg-status-conflict-bg aria-pressed:ring-status-conflict",
  unknown: "aria-pressed:bg-status-unknown-bg aria-pressed:ring-status-unknown",
};

export function HomeScreen() {
  const m = useMessages();
  const locale = useLocale();
  const t = m.home;
  const tp = m.profile;
  const tn = m.nearby.home;
  const announce = useAnnounce();
  const router = useRouter();
  const { settings, setProfile } = useProfile();
  const profile = settings.profile;
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);
  const [hideFailing, setHideFailing] = useState(false);
  const [thresholdsOpen, setThresholdsOpen] = useState(false);
  // The text in the search field; it becomes part of the query only on Enter or "Pokaż wyniki".
  const [q, setQ] = useState("");
  // Picked options (draft) vs the query the list and pins show (committed). Everything below that reads
  // `category`, `features`, `showUnknown` or `nearby` is the committed query; the controls show the draft.
  const [selection, setSelection] = useState(START_SELECTION);
  const { committed, draft } = selection;
  const category = committed.category ?? ALL;
  const features = committed.features;
  const showUnknown = committed.showUnknown;
  const categories = useCategories();
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stowedFlag, setStowed] = useSessionFlag(STOWED_KEY);
  const revealRef = useRef<string | null>(null);
  // Stays in this component: only the coarse `searchArea` goes to the API (see docs/architecture.md).
  const nearby = committed.nearby;
  const chosenPlace = nearby?.place;
  const nearbyRef = useRef<NearbyToggleHandle>(null);
  // Set by a command that asks at once (quick action, category by name): the position it waits for joins the query.
  const nearbyForCommand = useRef(false);
  const [quickId, setQuickId] = useState<QuickActionId | null>(null);
  const [unknownCommand, setUnknownCommand] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLAnchorElement>());
  const listRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
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
  const view = homeView(committed, peekFrom);
  const searching = view.searching;
  // A user's own "hide" is kept only within one state: the peek and the results each come back slid out.
  const wasSearching = useRef(searching);
  // Set while a search restored from the URL lands: that is not a new ask, so the panel keeps this session's state
  // (e.g. stowed). Cleared once the restored search is on screen.
  const restoring = useRef(false);
  useEffect(() => {
    if (wasSearching.current !== searching && !restoring.current) {
      // Clearing the search (or the last filter) is a full return to the start; asking starts the results fresh.
      const next = panelAfterAsk(wasSearching.current, searching, { expanded, stowed: stowedFlag, selectedId });
      setExpanded(next.expanded);
      setStowed(next.stowed);
      setSelectedId(next.selectedId);
      if (!searching) {
        setStatusFilter(null);
        setHideFailing(false);
        setUnknownCommand(false);
      }
    }
    wasSearching.current = searching;
    if (searching) restoring.current = false;
  }, [searching, expanded, stowedFlag, selectedId, setStowed]);
  // The query lives in the URL (`?q=…&category=…`), so Back from a place card shows the same results. A position
  // never goes there. Declared before the restore below: its first run (nothing restored yet) must not write.
  // `restoredNear`: the committed query restored from a URL that asked for results around the device; while it is
  // still the committed one, the URL keeps `near=1` and the position joins as soon as the device gives it.
  const [restoredNear, setRestoredNear] = useState<HomeCommitted | null>(null);
  const waitingForPosition = restoredNear !== null && restoredNear === committed;
  const committedSearch = committedToSearch(committed, waitingForPosition || undefined);
  const urlReady = useRef(false);
  useEffect(() => {
    if (urlReady.current && window.location.search !== committedSearch) {
      window.history.replaceState(null, "", `${window.location.pathname}${committedSearch}${window.location.hash}`);
    }
  }, [committedSearch]);
  useEffect(() => {
    const restored = searchToCommitted(window.location.search);
    const wantsNear = searchWantsNear(window.location.search);
    if (isSearching(restored) || wantsNear) {
      restoring.current = isSearching(restored);
      // The URL is only readable after hydration (reading it in the initial state would mismatch the server HTML).
      /* eslint-disable react-hooks/set-state-in-effect */
      setSelection({ committed: restored, draft: restored });
      setQ(restored.q);
      if (wantsNear) setRestoredNear(restored);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    urlReady.current = true;
  }, []);
  useEffect(() => {
    // The device answers after mount, so the position can only join the restored query from an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (waitingForPosition && peekNearby) setSelection((current) => commitChange(current, { nearby: peekNearby }));
  }, [waitingForPosition, peekNearby]);
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
  const draftFrom = useMemo(() => searchOrigin(draft.nearby, config.cityCenter), [draft.nearby]);
  // How far "W mojej okolicy" looks: 2 km at first, then what the user widened or searched; a new position starts over.
  const [scopeState, setScopeState] = useState<{ nearby: NearbyOrigin | null; scope: SearchScope }>({ nearby: null, scope: NEAR_SCOPE });
  const scope = scopeState.nearby === nearby ? scopeState.scope : NEAR_SCOPE;
  const area = nearby ? scopeArea(nearby, scope) : undefined;
  const query = { q: committed.q, category, features, includeUnknown: showUnknown, area };
  const filters = {
    q: query.q || undefined,
    category: category === ALL ? undefined : [category],
    feature: features.length ? [...features] : undefined,
    includeUnknown: features.length ? showUnknown : undefined,
    ...profileQuery(settings),
  };
  const queryKey = JSON.stringify(query);
  // The list holds the places of the map's view (the "W mojej okolicy" area when set; the whole city for a typed name),
  // nearest first, a page at a time; the map's pins come from the same filters, so everything on the map is also in the
  // list (R6). A new search first lists its own area (the map fits those results); the view counts once the camera
  // moved after they arrived.
  const settledSearch = useRef<string | null>(null);
  const [listedSearch, setListedSearch] = useState<string | null>(null);
  const [mapView, setMapView] = useState<TaggedView | null>(null);
  const listView = followedView(useDebounced(mapView, POINTS_DEBOUNCE_MS), queryKey);
  const listBox = listArea(area, listView, committed.q);
  const placesQuery = useInfinitePlaces(
    { ...filters, bbox: listBox, near: searchFrom.centre, limit: 100 },
    { enabled: searching },
  );
  const pages = placesQuery.data?.pages;
  const placesData = useMemo(
    () =>
      pages && {
        items: pages.flatMap((page) => page.items),
        total: pages[pages.length - 1].total,
        nextCursor: pages[pages.length - 1].nextCursor,
      },
    [pages],
  );
  // Keep-previous-data would otherwise leave the last results standing after the search is cleared.
  const places = {
    data: searching ? placesData : undefined,
    isError: searching && placesQuery.isError,
    isPlaceholderData: searching && placesQuery.isPlaceholderData,
    refetch: placesQuery.refetch,
  };
  const [loadedArea, setLoadedArea] = useState<Bbox | null>(null);
  const pointsBbox = useDebounced(area ?? loadedArea, POINTS_DEBOUNCE_MS);
  const points = usePlacePoints(searching && pointsBbox ? { ...filters, bbox: pointsBbox } : null);
  const followView = useCallback((view: Bbox, moved: boolean) => {
    setLoadedArea((loaded) => nextPointsArea(loaded, view));
    setMapView((current) => nextTaggedView(current, roundView(view), moved, settledSearch.current));
  }, []);
  const origin = searchFrom.from;
  // A text search keeps the API's ranking (best name matches and landmarks first); everything else is nearest first.
  const items = useMemo(
    () => (query.q ? withDistance : byDistance)(places.data?.items ?? [], origin ?? config.cityCenter),
    [places.data, origin, query.q],
  );
  const counts = useMemo(() => countByStatus(items), [items]);
  const shown = useMemo(() => filterByVerdict(items, { status: statusFilter, hideFailing }), [items, statusFilter, hideFailing]);
  const mapPlaces = useMemo(() => shown.map(({ place }) => place), [shown]);
  const mapFit = useMemo(() => fitTargets(committed.q, mapPlaces), [committed.q, mapPlaces]);
  const mapPoints = useMemo(
    () =>
      searching && points.data && !points.isError
        ? filterPointsByVerdict(points.data.items, { status: statusFilter, hideFailing })
        : undefined,
    [searching, points.data, points.isError, statusFilter, hideFailing],
  );
  const total = places.data?.total;
  // A quick action stays on while the list still shows its filters; changing them by hand ends it.
  const quick =
    (QUICK_ACTIONS as readonly QuickAction[]).find(
      (action) =>
        action.id === quickId &&
        quickStillApplies(action, { category: category === ALL ? null : category, features }),
    ) ?? null;
  const pending = places.isPlaceholderData || total === undefined;
  const quickState = useQuickResult({
    quick,
    origin,
    listPending: pending,
    listError: places.isError,
    items,
    from: chosenPlace ? "chosen" : "user",
    listQuery: { ...filters, bbox: listBox, near: searchFrom.centre },
  });
  const quickSays = quickAnnouncement(m, locale, quick, quickState);
  const partial = isPartial(places.data?.items.length ?? 0, total);
  const pinsCut = pointsCut(searching && !points.isError ? points.data : undefined);
  const verdicts = Boolean(profile && items.some(({ place }) => place.verdict));
  const verdictCount = items.filter(({ place }) => place.verdict).length;
  const missing = useMemo(() => (verdicts && counts.met === 0 ? missingNeeds(items).slice(0, 3) : []), [verdicts, counts.met, items]);
  // Rows kept while only the list's box changes (the fit, a pan) still belong to this search, so the route prompt stays.
  const settled = !places.isPlaceholderData || listedSearch === queryKey;
  const routeTo = useMemo(
    () =>
      settled && !places.isError ? routeTarget(committed.q, shown.map(({ place }) => place)) : null,
    [settled, places.isError, committed.q, shown],
  );
  // Place names matching the typed text: a small request of their own, since typing no longer loads results.
  const { value: typed } = useDebouncedValue(q.trim());
  const nameQuery = usePlaces(
    { q: typed, near: draftFrom.centre, limit: SUGGESTION_LIMIT, ...profileQuery(settings) },
    { enabled: typed.length > 0 },
  );
  const placeNames = useMemo(
    () =>
      typed && typed === q.trim() && !nameQuery.isPlaceholderData
        ? [...new Set((nameQuery.data?.items ?? []).map((place) => place.name))]
        : [],
    [typed, q, nameQuery.data, nameQuery.isPlaceholderData],
  );

  const chosenSummary = [
    q.trim() ? `„${q.trim()}”` : null,
    draft.category ? categories.data?.find((c) => c.id === draft.category)?.label : null,
    ...draft.features.map((feature) => t.filters[feature]),
    draft.nearby ? (draft.nearby.place ?? t.confirm.nearby) : null,
  ]
    .filter(Boolean)
    .join(", ");
  // The count on "Pokaż wyniki (N)": a one-row request of the draft, debounced, keeping the last number meanwhile.
  const confirm = confirmAction(selection, q);
  const asked = draftAsk(selection, q);
  const countBox = listArea(draftFrom.area, listView, asked?.q);
  const countKey = JSON.stringify([asked, countBox, settings.profile]);
  const countFilters = useMemo(
    () =>
      asked && {
        q: asked.q || undefined,
        category: asked.category ? [asked.category] : undefined,
        feature: asked.features.length ? [...asked.features] : undefined,
        includeUnknown: asked.features.length ? asked.showUnknown : undefined,
        ...profileQuery(settings),
        bbox: countBox,
        near: draftFrom.centre,
        limit: 1,
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `countKey` is the value of everything read here
    [countKey],
  );
  const debouncedCountFilters = useDebounced(countFilters, POINTS_DEBOUNCE_MS);
  const countQuery = usePlaces(debouncedCountFilters ?? { limit: 1 }, { enabled: confirm === "show" && Boolean(debouncedCountFilters) });
  const countNow = confirm === "show" && !countQuery.isPlaceholderData ? countQuery.data?.total : undefined;
  const [shownCount, setShownCount] = useState<number | null>(null);
  const nextCount = confirm !== "show" ? null : (countNow ?? shownCount);
  if (nextCount !== shownCount) setShownCount(nextCount);
  // The button's number is read out when it settles (the layout's one live region).
  useEffect(() => {
    if (shownCount !== null) announce(t.confirm.countAnnounce(shownCount));
  }, [announce, shownCount, t]);
  // Categories the typed text names come first (instantly, no request), then the matching place names.
  const suggestions = useMemo((): SearchSuggestion[] => {
    const named = matchCategories(q, categories.data ?? []).suggestions.map((c): SearchSuggestion => {
      const full = categories.data?.find((entry) => entry.id === c.id);
      return { kind: "category", id: c.id, label: c.label, icon: full?.icon };
    });
    return [...named, ...placeNames.map((name): SearchSuggestion => ({ kind: "place", name }))];
  }, [q, categories.data, placeNames]);

  const resultsLabel = !searching
    ? t.list.start[view.heading]
    : total === undefined
      ? t.list.loading
      : partial && shown.length === items.length
        ? t.list.firstOf(items.length, total!)
        : t.list.results(listedCount(places.data!, shown.length));
  // The list renders a window of rows that grows by a page; a new search or verdict filter starts it over.
  const windowKey = `${queryKey}|${statusFilter}|${hideFailing}`;
  const [listWindow, setListWindow] = useState({ key: windowKey, rendered: LIST_PAGE });
  const rendered = listWindow.key === windowKey ? listWindow.rendered : LIST_PAGE;
  const rows = useMemo(() => shown.slice(0, rendered), [shown, rendered]);
  const growWindow = (size: (current: number) => number) =>
    setListWindow((current) => ({ key: windowKey, rendered: size(current.key === windowKey ? current.rendered : LIST_PAGE) }));
  // Back at the start nothing is settled: a pan there must not count for the next search, even the same one again.
  const listed = searching && !pending ? queryKey : searching ? listedSearch : null;
  useEffect(() => {
    if (!searching) settledSearch.current = null;
    else if (!pending) settledSearch.current = queryKey;
  }, [searching, pending, queryKey]);
  if (listedSearch !== listed) setListedSearch(listed);
  const listAnnouncement =
    total === undefined
      ? null
      : verdicts && profile
        ? tp.announce(profile, shown.length, items.length, counts)
        : partial
          ? (listBox ? t.list.announcePartial : t.list.announcePartialFound)(items.length, total!)
          : t.list.announce(listedCount(places.data!, shown.length));
  const announcement =
    listAnnouncement &&
    [
      quickSays,
      origin ? (chosenPlace ? tn.announceChosen(chosenPlace) : tn.announce) : null,
      origin && scope.kind !== "near" ? tn.announceScope[scope.kind] : null,
      listAnnouncement, pinsCut ? t.map.pinsCut(pinsCut.shown, pinsCut.total) : null,
    ]
      .filter(Boolean)
      .join(". ");
  useEffect(() => {
    if (pending || !announcement) return;
    // A run of pans settles into one announcement.
    const timer = setTimeout(() => announce(announcement), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
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

  // Picking an option only changes the draft (and shows the confirm button); results stay as they were.
  function pick(change: Partial<HomeChoices>) {
    nearbyForCommand.current = false;
    setSelection((current) => choose(current, change));
    if (stowedFlag) setStowed(false);
  }

  // A command asks at once: the draft becomes the query without the confirm button.
  function ask(next: Partial<HomeChoices> & { q?: string }) {
    setQ(next.q ?? "");
    setSelection((current) => runAsk(current, next));
    setStatusFilter(null);
    setHideFailing(false);
  }

  function locateForCommand() {
    nearbyForCommand.current = true;
    nearbyRef.current?.locate();
  }

  function changeNearby(next: NearbyOrigin | null) {
    if (nearbyForCommand.current) {
      nearbyForCommand.current = false;
      setSelection((current) => commitChange(current, { nearby: next }));
    } else pick({ nearby: next });
  }

  function toggleFeature(feature: FeatureFilter) {
    const current = draft.features;
    pick({ features: current.includes(feature) ? current.filter((f) => f !== feature) : FEATURES.filter((f) => f === feature || current.includes(f)) });
  }

  // "Pokaż wyniki" (or Enter): the picked options and the typed text become the query; with nothing picked it clears.
  function showSelection(text = q) {
    nearbyForCommand.current = false;
    setUnknownCommand(false);
    if (confirmAction(selection, text) === "clear") return resetView();
    setSelection((current) => showResults(current, text));
    setStatusFilter(null);
    setHideFailing(false);
  }

  function startQuick(action: QuickAction) {
    setQuickId(action.id);
    const filters = quickFilters(action);
    ask({ category: filters.category, features: filters.features });
    if (!draft.nearby) locateForCommand();
  }

  function runQuick(action: QuickAction) {
    if (quick?.id !== action.id) return startQuick(action);
    setQuickId(null);
    ask({});
  }

  // "najbliższa toaleta" (said or typed): the matching quick action, or just the category with "W mojej
  // okolicy" on; true when `text` was such a command. It never toggles an action off.
  function runCommand(text: string) {
    const parsed = parseNearestCommand(text, categories.data ?? []);
    setUnknownCommand(parsed?.kind === "unknown");
    if (!parsed) {
      // A word that names a category ("restauracje") works like picking its chip.
      const exact = matchCategories(text, categories.data ?? []).exact;
      if (!exact) return false;
      pickCategory(exact.id);
      return true;
    }
    if (parsed.kind === "unknown") {
      announce(`${t.command.unknownTitle} ${t.command.unknownHint}`);
      return true;
    }
    const { quick: quickAction, category: id } = parsed.command;
    if (quickAction) {
      if (quick?.id === quickAction.id) {
        if (!draft.nearby) locateForCommand();
      } else startQuick(quickAction);
      return true;
    }
    pickCategory(id ?? ALL);
    return true;
  }

  // The nearest places of a category: around the device when the position is known (or already allowed), else
  // the user is asked, since picking a category is an explicit action. Declined: the list says it is from Rynek.
  // `forCommand`: the position joins the query at once (a command), not only the draft (a chip).
  function locateForCategory(id: string, forCommand: boolean) {
    if (id === ALL || draft.nearby) return;
    if (peekNearby) setSelection((current) => (forCommand ? commitChange(current, { nearby: peekNearby }) : choose(current, { nearby: peekNearby })));
    else if (forCommand) locateForCommand();
    else nearbyRef.current?.locate();
  }

  // A category chosen by name (suggestion, Enter on an exact word, spoken command): the chip, nothing else narrowing.
  function pickCategory(id: string) {
    setQuickId(null);
    setUnknownCommand(false);
    ask({ category: id === ALL ? null : id });
    announce(t.command.applied(categories.data?.find((c) => c.id === id)?.label ?? ""));
    locateForCategory(id, true);
  }

  function changeScope(next: SearchScope) {
    setScopeState({ nearby, scope: next });
    setSelectedId(null);
  }
  const wider = nearby ? widerScope(scope) : null;
  // The map was moved or zoomed out past the searched area: offer to search where it is now.
  const searchHere = Boolean(searching && nearby && !pending && !places.isError && viewLeavesArea(area, mapView?.view ?? null));

  // With "W mojej okolicy" on, the area is what narrowed the search: drop only it, so the same search runs over the
  // whole city. Otherwise keep only the typed name, or go back to the start without one.
  function searchWider() {
    if (nearby) {
      setUnknownCommand(false);
      setSelection((current) => commitChange(current, { nearby: null }));
    } else if (widened) {
      startOver(widened);
    }
  }

  function startOver(next: HomeSelection = START_SELECTION) {
    setQuickId(null);
    setUnknownCommand(false);
    nearbyForCommand.current = false;
    setQ(next.committed.q);
    setSelection(next);
    setStatusFilter(null);
    setHideFailing(false);
  }
  const widened = widenSearch(selection);

  // Anything that hides part of the city from the map and list, picked or already shown; "back" undoes all of it at once.
  const narrowed = Boolean(q || isSearching(committed) || isSearching({ q: "", ...draft }) || statusFilter || hideFailing);

  function resetView() {
    startOver();
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
    // A pin whose row isn't loaded yet (a later page of the view) opens its card.
    if (!shown.some(({ place }) => place.id === id)) {
      router.push(routes.place(id));
      return;
    }
    setSelectedId(id);
    const needed = windowFor(shown.findIndex(({ place }) => place.id === id), rendered);
    if (stowed || needed !== rendered) {
      revealRef.current = id;
      if (needed !== rendered) growWindow(() => needed);
      if (stowed) setStowed(false);
    } else reveal(id);
  }

  // One more step of the list: rows already fetched first, then the next page from the server.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = placesQuery;
  const moreOnServer = searching && Boolean(hasNextPage);
  const pendingMore = useRef<{ key: string; pages: number; from: number; focus: boolean } | null>(null);
  const listKey = JSON.stringify([queryKey, listBox]);
  function loadMore(focus: boolean) {
    if (rendered < shown.length) {
      if (focus) focusRowRef.current = shown[rendered]?.place.id ?? null;
      growWindow((current) => nextWindow(current, shown.length));
    } else if (moreOnServer && !isFetchingNextPage) {
      pendingMore.current = { key: listKey, pages: pages?.length ?? 0, from: shown.length, focus };
      fetchNextPage();
    }
  }
  // A page the server had to send: once it lands, the window grows over its first row (a page the verdict filter
  // hides entirely asks for the next).
  useEffect(() => {
    const waiting = pendingMore.current;
    if (!waiting) return;
    if (waiting.key !== listKey) pendingMore.current = null;
    else if (!isFetchingNextPage && (pages?.length ?? 0) > waiting.pages) {
      if (shown.length > waiting.from) {
        pendingMore.current = null;
        if (waiting.focus) focusRowRef.current = shown[waiting.from].place.id;
        growWindow((current) => nextWindow(current, shown.length));
      } else if (hasNextPage) {
        pendingMore.current = { ...waiting, pages: pages?.length ?? 0 };
        fetchNextPage();
      } else pendingMore.current = null;
    }
  });

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
  const hasMore = rendered < shown.length || moreOnServer;
  const loadMoreOnScroll = useEffectEvent(() => loadMore(false));
  useEffect(() => {
    const more = moreRef.current;
    if (!more || !hasMore || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreOnScroll();
      },
      { root: scrollParent(more), rootMargin: "0px 0px 400px 0px" },
    );
    observer.observe(more);
    return () => observer.disconnect();
  }, [hasMore, isFetchingNextPage, windowKey, shown.length, rendered]);

  // The verdict counters filter the results, so they stay above the list as one compact row.
  const verdictCounters =
    profile && searching ? (
      <div key="counters" className="space-y-2 px-4 pb-2">
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
        {missing.length && !pending ? (
          <div role="note" className="space-y-1 rounded-2xl border border-border bg-card px-3 py-2.5 text-body-sm">
            <p className="font-semibold">{tp.list.noneMet.title}</p>
            <p>{tp.list.noneMet.missing(missing, verdictCount)}</p>
            <p className="text-muted-foreground">{tp.list.noneMet.hint}</p>
          </div>
        ) : null}
      </div>
    ) : null;
  const controls = (
    <div key="controls" ref={controlsRef} id={CONTROLS_ID} tabIndex={-1} className="space-y-2 px-4 pb-2 outline-none">
      <ProfileSwitch value={profile} onChange={changeProfile} />
      <NearbyToggle
        ref={nearbyRef}
        origin={draft.nearby}
        onChange={changeNearby}
        privacy={scope.kind !== "near" && draft.nearby === nearby ? tn.privacyScope[scope.kind] : undefined}
      />
      {unknownCommand ? (
        <div role="note" className="space-y-1 rounded-2xl border border-border bg-card px-3 py-2.5 text-body-sm">
          <p className="font-semibold">{t.command.unknownTitle}</p>
          <p>{t.command.unknownHint}</p>
        </div>
      ) : null}
      {profile && searching ? (
        <LabeledSwitch label={tp.hideFailing} checked={hideFailing} onCheckedChange={changeHideFailing} className="-my-1" />
      ) : null}
      <div role="group" aria-label={t.filtersLabel} className={cn(CHIP_ROW, "-mx-4 flex gap-2 pl-4")}>
        {FEATURES.map((feature) => (
          <Toggle key={feature} pressed={draft.features.includes(feature)} onPressedChange={() => toggleFeature(feature)} className={CHIP}>
            {t.filters[feature]}
          </Toggle>
        ))}
      </div>
      {draft.features.length ? (
        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 text-body-sm font-semibold">
          <span>{t.showUnknown}</span>
          <Switch checked={draft.showUnknown} onCheckedChange={(on) => pick({ showUnknown: on })} />
        </label>
      ) : null}
    </div>
  );
  const listBlock = (
    <div key="list" ref={listRef} id={LIST_ID} tabIndex={-1} className="scroll-mt-2 px-4 pt-1 pb-8 outline-none">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-caption font-semibold text-muted-foreground">{resultsLabel}</h2>
        {searching ? (
          <button
            type="button"
            onClick={() => controlsRef.current?.focus()}
            className="min-h-6 rounded-full text-caption font-semibold text-primary underline outline-offset-2"
          >
            {t.list.filtersJump}
          </button>
        ) : null}
      </div>
      {pinsCut ? <p className="mb-2 text-body-sm text-muted-foreground">{t.map.pinsCut(pinsCut.shown, pinsCut.total)}</p> : null}
      {searching && wider && !pending && !places.isError && shown.length > 0 && shown.length < POOR_RESULTS ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-body-sm text-muted-foreground">{tn.poorHint}</p>
          <Button variant="outline" onClick={() => changeScope(wider)}>
            {tn.widen[wider.kind as "wide" | "city"]}
          </Button>
        </div>
      ) : null}
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
            <>
              <p role="status" className="sr-only">
                {t.list.loading}
              </p>
              <PlaceListSkeleton rows={PEEK_LIMIT} />
            </>
          ) : peekItems.length ? (
            <ul className="space-y-2.5">
              {peekItems.map(({ place, distance }, index) => (
                <PlaceRow
                  key={place.id}
                  index={index}
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
                  {scope.kind !== "near" ? tn.scopeHint[scope.kind] : chosenPlace ? tn.emptyHintChosen(chosenPlace) : tn.emptyHint}
                </p>
              ) : null}
              {features.length && !showUnknown ? (
                <p className="text-body-sm text-muted-foreground">
                  {t.list.noFeatureMatch(features.map((f) => t.filters[f]).join(", "))}
                </p>
              ) : null}
              {category === "parking" ? (
                <p className="text-body-sm text-muted-foreground">
                  {t.list.licenceHold[category]}{" "}
                  <Link href={routes.aboutData} className="font-semibold text-primary underline">
                    {t.list.licenceHold.link}
                  </Link>
                </p>
              ) : null}
              {origin ? null : (
                <p className="text-body-sm text-muted-foreground">{widened?.committed.q ? t.list.emptyHintKeepName : t.list.emptyHint}</p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                {wider ? (
                  <Button onClick={() => changeScope(wider)}>{tn.widen[wider.kind as "wide" | "city"]}</Button>
                ) : null}
                {nearby || widened ? (
                  <Button variant="outline" onClick={searchWider}>
                    {t.list.searchWider}
                  </Button>
                ) : null}
                {features.length && !showUnknown ? (
                  <Button variant="ghost" onClick={() => setSelection((current) => commitChange(current, { showUnknown: true }))}>
                    {t.showUnknown}
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : total === undefined ? (
        <PlaceListSkeleton />
      ) : (
        <ul className="space-y-2.5">
          {rows.map(({ place, distance }, index) => (
            <PlaceRow
              index={index}
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
          <Button variant="outline" className="w-full" disabled={isFetchingNextPage} onClick={() => loadMore(true)}>
            {t.list.more(Math.min(rendered, shown.length), partial && shown.length === items.length ? total! : shown.length)}
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
      onKeyDown={(event) => {
        // A popup or dialog that took Escape has already cancelled it.
        if (event.key !== "Escape" || event.defaultPrevented) return;
        const step = escapeStep({ expanded, selectedId });
        if (step === "deselect") setSelectedId(null);
        else if (step === "collapse") setExpanded(false);
      }}
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
          <SearchBox
            value={q}
            onValueChange={setQ}
            suggestions={suggestions}
            onPickCategory={pickCategory}
            onPickPlace={showSelection}
            onSubmit={showSelection}
            onClear={() => setSelection(clearQuery)}
            onCommand={runCommand}
          />
        </div>
        <ToggleGroup
          aria-label={t.categoriesLabel}
          value={[draft.category ?? ALL]}
          onValueChange={(value) => {
            if (!value[0]) return;
            pick({ category: value[0] === ALL ? null : value[0] });
            locateForCategory(value[0], false);
          }}
          // iOS WebKit won't pan a scroller with pointer-events: none, even under chips that have auto.
          className={cn(CHIP_ROW, "pointer-events-auto mx-auto mt-1.5 max-w-xl pl-4")}
        >
          <Toggle value={ALL} className={cn("shadow-soft", CHIP)}>
            {t.categoryAll}
          </Toggle>
          {categories.data?.map((c) => (
            <Toggle key={c.id} value={c.id} className={cn("shadow-soft", CHIP)}>
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
          {confirm !== "hidden" ? (
            <div role="group" aria-label={t.confirm.label} className="space-y-2 rounded-2xl bg-primary-container px-4 py-3">
              {chosenSummary ? <p className="text-body-sm font-semibold">{t.confirm.summary(chosenSummary)}</p> : null}
              <Button className="min-h-11 w-full" aria-busy={confirm === "show" && countQuery.isFetching} onClick={() => showSelection()}>
                {confirm === "clear" ? t.confirm.clear : shownCount === null ? t.confirm.show : t.confirm.showCount(shownCount)}
              </Button>
            </div>
          ) : null}
        </div>
        {searching ? [verdictCounters, listBlock, controls] : [listBlock, controls]}
      </BottomPanel>
      {/* Resolves --list-collapsed in px: the map's padding and controls never rise above the half-height panel. */}
      <div ref={collapsedRef} aria-hidden className="pointer-events-none invisible absolute bottom-0 left-0 h-(--list-collapsed) w-px lg:hidden" />
      {/* Phone: the map fills the screen at every panel height and the panel lies over it, so it never resizes. */}
      <div className="absolute inset-0 lg:relative lg:inset-auto lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0">
        <PlaceMap
          places={mapPlaces}
          fitKey={searching && !pending ? queryKey : null}
          fitTo={mapFit}
          points={mapPoints ?? (places.isPlaceholderData ? [] : undefined)}
          onViewChange={followView}
          selectedId={selectedId}
          onSelect={selectFromMap}
          padding={desktop ? MAP_PADDING_DESKTOP : MAP_PADDING}
          inset={desktop ? 0 : panelInset}
          revealSelected={!desktop}
          controlsClassName={CONTROLS_ABOVE_PANEL}
          you={searching ? origin : peekFrom.from}
          youLabel={chosenPlace}
        />
        {searchHere ? (
          <div className="pointer-events-none absolute inset-x-0 top-[9.5rem] z-10 flex justify-center lg:top-4">
            <Button
              variant="outline"
              className="pointer-events-auto shadow-float"
              onClick={() => mapView && changeScope(viewScope(mapView.view))}
            >
              {tn.searchHere}
            </Button>
          </div>
        ) : null}
      </div>
      <ThresholdsDrawer open={thresholdsOpen} onOpenChange={setThresholdsOpen} />
    </main>
  );
}
