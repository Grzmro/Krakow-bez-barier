"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { PlacePoint, PlaceSummary } from "@krakow-bez-barier/contracts";
import { cn, MOTION, motionMs, reducedMotion, useAnnounce } from "@krakow-bez-barier/ui";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMessages } from "@/i18n/client";
import { useCategoryLookup } from "@/lib/categories";
import { config } from "@/lib/config";
import { blankMissingImages } from "@/lib/map-images";
import {
  buildClusterIndex,
  clusterPlaceIds,
  clusterZoom,
  expansionZoom,
  mapItems,
  markerMoves,
  placesInView,
  verdictBreakdown,
  type ClusterIndex,
  type MapItem,
  type MarkerSpot,
} from "@/lib/map-clusters";
import { toPoint, type Bbox } from "@/lib/map-points";
import { markerTransition } from "@/lib/marker-motion";
import { MapControls } from "../map/map-controls";
import { insidePadding, mapPadding, paddedCentre, type Padding } from "../map/map-padding";
import { clusterSize, PlaceCluster } from "./place-cluster";
import { PlacePin } from "./place-pin";

// The map fills a phone's screen; at 3x (iPhone) that canvas is ~3 Mpx redrawn every frame of a pan. 2x stays sharp.
const MAX_PIXEL_RATIO = 2;
const PIN_CLASS = "group relative size-9 cursor-pointer data-[selected=true]:z-10";
// How often markers catch up with a pan between its start and end (ms).
const PAN_REFRESH_MS = 250;
// Share of the view's width and height loaded as markers beyond each edge.
const VIEW_MARGIN = 0.2;
// Most marker transitions one refresh starts; the rest change at once, so a big jump stays smooth on a phone.
const MAX_TRANSITIONS = 60;

// Rendered once per look (category and verdict, or count and breakdown) and cloned for each marker.
const templates = new Map<string, Element>();
const MAX_TEMPLATES = 400;

function fromTemplate(key: string, render: () => ReactNode): Element {
  let template = templates.get(key);
  if (!template) {
    const host = document.createElement("div");
    const root = createRoot(host);
    flushSync(() => root.render(render()));
    template = host.firstElementChild!.cloneNode(true) as Element;
    // Unmounting synchronously from inside a React commit warns; defer it.
    queueMicrotask(() => root.unmount());
    if (templates.size >= MAX_TEMPLATES) templates.clear();
    templates.set(key, template);
  }
  return template.cloneNode(true) as Element;
}

/** A marker's element (MapLibre positions it) around a body that the enter and leave transitions animate. */
function shell(className: string, content: Element) {
  const element = document.createElement("div");
  element.className = className;
  const body = document.createElement("div");
  body.className = "relative size-full";
  body.append(content);
  element.append(body);
  return { element, body };
}

function pinElement(place: PlacePoint, icon: Icon, title: string) {
  const look = fromTemplate(`p:${place.category}:${place.verdict}`, () => <PlacePin status={place.verdict} icon={icon} />);
  const { element, body } = shell(PIN_CLASS, look);
  element.setAttribute("aria-hidden", "true");
  element.title = title;
  element.dataset.placeId = place.id;
  element.dataset.category = place.category;
  if (place.verdict) element.dataset.status = place.verdict;
  return { element, body };
}

function clusterElement(item: Extract<MapItem, { kind: "cluster" }>, label: string) {
  const breakdown = verdictBreakdown(item.counts);
  const verdicts = breakdown.map(([status, n]) => `${status}:${n}`).join(" ");
  const look = fromTemplate(`c:${item.count}:${verdicts}`, () => <PlaceCluster count={item.count} breakdown={breakdown} />);
  const { element, body } = shell("group relative cursor-pointer data-[selected=true]:z-10", look);
  const size = clusterSize(item.count);
  element.style.width = element.style.height = `${size}px`;
  // Not a tab stop, like the pins: keyboard users zoom with +/- or the arrows, and the list holds every place.
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", label);
  element.title = label;
  element.dataset.clusterCount = String(item.count);
  element.dataset.verdicts = verdicts;
  return { element, body };
}

function youElement(you: string) {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  element.dataset.you = "true";
  element.className = "pointer-events-none flex flex-col items-center gap-1";
  const label = document.createElement("span");
  label.className = "rounded-full bg-ink px-2 py-0.5 text-caption font-semibold text-ink-foreground shadow-soft";
  label.textContent = you;
  const dot = document.createElement("span");
  dot.className = "size-5 rounded-full bg-primary ring-4 ring-card shadow-float";
  element.append(label, dot);
  return element;
}

/** `leaves` = a cluster's place ids, listed only once a selection asks which cluster holds it. */
type MarkerEntry = { marker: Marker; body: HTMLElement; item: MapItem; index: ClusterIndex; leaves?: ReadonlySet<string> };
type Markers = Map<string, MarkerEntry>;

/** Marks the pin of the selected place, or the cluster that holds it. */
function markSelected(markers: Markers, selectedId: string | null) {
  const entries = [...markers.values()];
  const pin = selectedId === null ? undefined : entries.find(({ item }) => item.kind === "place" && item.place.id === selectedId);
  let holder = pin;
  const at = selectedId === null || pin ? undefined : entries[0]?.index.byId.get(selectedId)?.location.coordinates;
  if (selectedId !== null && at) {
    // Nearest clusters first: the holder is almost always the first one, so few leaves get listed.
    const distance = ({ item }: MarkerEntry) => (item.coordinates[0] - at[0]) ** 2 + (item.coordinates[1] - at[1]) ** 2;
    const clusters = entries.filter(({ item }) => item.kind === "cluster").sort((a, b) => distance(a) - distance(b));
    holder = clusters.find((entry) => {
      if (entry.item.kind !== "cluster") return false;
      entry.leaves ??= new Set(clusterPlaceIds(entry.index, entry.item.clusterId));
      return entry.leaves.has(selectedId);
    });
  }
  for (const entry of entries) entry.marker.getElement().dataset.selected = String(entry === holder);
}

const SHOWN_DATA = ["placeId", "clusterCount", "category", "status", "verdicts", "selected"];

/**
 * Takes a marker off the map: at once, or when its leave transition ends. Either way it stops counting as
 * shown right away, for taps, assistive tech and tests alike.
 */
function retire(marker: Marker, leaving: Set<Marker>, animation: Animation | null) {
  const element = marker.getElement();
  for (const name of SHOWN_DATA) delete element.dataset[name];
  element.removeAttribute("role");
  element.removeAttribute("aria-label");
  element.removeAttribute("title");
  element.setAttribute("aria-hidden", "true");
  element.style.pointerEvents = "none";
  if (!animation) {
    marker.remove();
    return;
  }
  leaving.add(marker);
  const done = () => {
    leaving.delete(marker);
    marker.remove();
  };
  animation.onfinish = done;
  animation.oncancel = done;
}

function clearMarkers(markers: Markers, leaving: Set<Marker>) {
  for (const { marker } of markers.values()) marker.remove();
  markers.clear();
  for (const marker of leaving) marker.remove();
  leaving.clear();
}

/**
 * Whether a screen point is on a `width` × `height` map or close to it: off-screen markers change without a
 * transition. The size is read once per refresh, before markers are added: reading it after each would force a layout.
 */
function nearView({ x, y }: { x: number; y: number }, width: number, height: number) {
  const margin = 60;
  return x > -margin && y > -margin && x < width + margin && y < height + margin;
}

const samePadding = (a: Padding, b: Padding) => a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right;

function currentPadding(map: MapLibreMap): Padding {
  const { top = 0, bottom = 0, left = 0, right = 0 } = map.getPadding();
  return { top, bottom, left, right };
}

const paddingPending = new WeakSet<MapLibreMap>();

/** Whether `target` is in the map's visible area, clear of its padding. */
function pointInView(map: MapLibreMap, target: [number, number]) {
  const { clientWidth: width, clientHeight: height } = map.getContainer();
  return insidePadding(map.project(target), width, height, currentPadding(map));
}

/**
 * Sets the map's padding without moving what is on screen: the point under the new padded centre
 * becomes the map's centre. Waits for a running camera move (a fit, a pan's inertia) to end first.
 */
function applyPadding(map: MapLibreMap, padding: () => Padding) {
  if (map.isMoving()) {
    // One deferred call per map: `padding` reads the latest values when it runs.
    if (!paddingPending.has(map)) {
      paddingPending.add(map);
      map.once("moveend", () => {
        paddingPending.delete(map);
        applyPadding(map, padding);
      });
    }
    return;
  }
  const { clientWidth: width, clientHeight: height } = map.getContainer();
  const next = padding();
  if (!width || !height || samePadding(next, currentPadding(map))) return;
  map.jumpTo({ center: map.unproject(paddedCentre(width, height, next)), padding: next });
}

/** Eases the map to `target` when it is hidden under the overlays or the panel, or off the map. */
function revealPoint(map: MapLibreMap, target: [number, number]) {
  const { clientWidth: width, clientHeight: height } = map.getContainer();
  if (!width || !height || pointInView(map, target)) return;
  map.easeTo({ center: target, duration: motionMs(MOTION.slow) });
}

export interface PlaceMapProps {
  /** The places of the list: the map fits them when they change and eases to the selected one. */
  places: PlaceSummary[];
  /**
   * For a list that follows the map's view: fit once per key (the first `places` that come with it) instead of whenever
   * the places change, which would pull the map back after every pan. `null` = not yet (still loading).
   */
  fitKey?: string | null;
  /** The places the map fits instead of all `places`: the one a name search clearly found, or its best matches. */
  fitTo?: readonly PlaceSummary[];
  /** What the pins and clusters show, e.g. every place in the viewport; `places` themselves when left out. */
  points?: PlacePoint[];
  /**
   * The whole map's view (`[west, south, east, north]`) after each camera move (`moved`), and whenever the pins are
   * redrawn without one, to load the points for it.
   */
  onViewChange?: (view: Bbox, moved: boolean) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Space covered by overlays (search on top, map controls at the bottom), in px. */
  padding: { top: number; bottom: number };
  /** Height (px) of the map's bottom covered by a panel laid over it; added to the bottom padding. */
  inset?: number;
  /** Ease the map to the selected place whenever it is hidden under the overlays or the panel. */
  revealSelected?: boolean;
  /** Extra classes of the attribution and zoom buttons, e.g. to lift them above a panel. */
  controlsClassName?: string;
  /** The user's position (`[lon, lat]`): shown as "Ty" and the map centres on it instead of fitting the places. */
  you?: [number, number] | null;
  /** Label of the `you` marker when it is a chosen point rather than the user ("Ty"). */
  youLabel?: string;
  /** Accessible name of the map; defaults to the home screen's ("... The list has the same places."). */
  label?: string;
  className?: string;
}

/**
 * MapLibre map with category-icon pins, neutral or shaped by their verdict when a profile is on. Nearby
 * pins merge into clusters (a verdict donut with a profile); only what is in or near the viewport gets a
 * DOM marker. On zoom, a cluster's children fly out of it (and back in), or only fade with less motion.
 * Pins are mouse shortcuts only and hidden from assistive tech: the list next to the map
 * holds the same places, and the canvas's description gives the number of places in view.
 */
export function PlaceMap({
  places,
  fitKey,
  fitTo,
  points,
  onViewChange,
  selectedId,
  onSelect,
  padding,
  inset = 0,
  revealSelected = false,
  controlsClassName,
  you = null,
  youLabel: chosenLabel,
  label,
  className,
}: PlaceMapProps) {
  const messages = useMessages();
  const t = messages.home.map;
  const statusWords = messages.common.status;
  const announce = useAnnounce();
  const category = useCategoryLookup();
  const descriptionId = useId();
  const [inView, setInView] = useState<number | null>(null);
  const youLabel = chosenLabel ?? messages.nearby.home.you;
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const markersRef = useRef<Markers>(new Map());
  const leavingRef = useRef(new Set<Marker>());
  const labelsRef = useRef<unknown[]>([]);
  const pinned = useMemo(() => points ?? places.map(toPoint), [points, places]);
  const index = useMemo(() => buildClusterIndex(pinned), [pinned]);
  const fittedRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const onViewChangeRef = useRef(onViewChange);
  const paddingRef = useRef(padding);
  const insetRef = useRef(inset);
  const selectedIdRef = useRef(selectedId);
  const placesRef = useRef(places);
  const [youLon, youLat] = you ?? [];
  const centered = Boolean(you);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onViewChangeRef.current = onViewChange;
    paddingRef.current = padding;
    insetRef.current = inset;
    selectedIdRef.current = selectedId;
    placesRef.current = places;
  });
  // The map keeps its size; what the overlays and the panel cover is its padding, so fits and eases keep clear of them.
  const paddingFor = useCallback(
    (instance: MapLibreMap) => () => mapPadding(paddingRef.current, insetRef.current, instance.getContainer().clientHeight),
    [],
  );

  useEffect(() => {
    let disposed = false;
    let instance: MapLibreMap | null = null;
    const markers = markersRef.current;
    const leaving = leavingRef.current;
    import("maplibre-gl")
      .then(({ Map, setWorkerUrl }) => {
        if (disposed || !containerRef.current) return;
        setWorkerUrl(config.mapWorkerUrl);
        instance = new Map({
          container: containerRef.current,
          style: config.mapStyleUrl,
          center: config.cityCenter,
          zoom: config.initialZoom,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          pixelRatio: Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO),
        });
        instance.touchZoomRotate.disableRotation();
        blankMissingImages(instance);
        setMap(instance);
      })
      .catch(() => {
        if (!disposed) setUnavailable(true);
      });
    return () => {
      disposed = true;
      clearMarkers(markers, leaving);
      instance?.remove();
    };
  }, []);

  // `data-moving` mirrors the camera (a gesture, its inertia or an ease): tests wait on it before measuring the map.
  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    const start = () => (container.dataset.moving = "true");
    const end = () => (container.dataset.moving = "false");
    container.dataset.moving = String(map.isMoving());
    map.on("movestart", start);
    map.on("moveend", end);
    return () => {
      map.off("movestart", start);
      map.off("moveend", end);
    };
  }, [map]);

  // MapLibre names the canvas once, at creation; this keeps it in the current language.
  useEffect(() => {
    map?.getCanvas().setAttribute("aria-label", label ?? t.label);
    map?.getCanvas().setAttribute("aria-describedby", descriptionId);
  }, [map, label, t.label, descriptionId]);

  // Markers follow the camera: re-clustered when a zoom (a pinch, a cluster tap's ease) crosses a clustering level and
  // a little while into a pan, so clusters split under the fingers; fully refreshed when the camera stops.
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    let detach: (() => void) | null = null;
    const markers = markersRef.current;
    const leaving = leavingRef.current;
    // New copy (a language switch) or category icons (loaded after the first pins) rebuild the markers at once.
    const labels = [t, statusWords, category];
    if (labelsRef.current.some((value, i) => value !== labels[i])) {
      clearMarkers(markers, leaving);
      templates.clear();
    }
    labelsRef.current = labels;
    import("maplibre-gl").then(({ Marker }) => {
      if (cancelled) return;

      const create = (item: MapItem) => {
        if (item.kind === "place") {
          const { place } = item;
          const { label: categoryLabel, icon } = category(place.category);
          const status = place.verdict ? statusWords[place.verdict] : null;
          const { element, body } = pinElement(place, icon, t.pin(place.name, categoryLabel, status));
          element.addEventListener("click", (event) => {
            event.stopPropagation();
            onSelectRef.current(place.id);
          });
          const marker = new Marker({ element, offset: item.offset }).setLngLat(item.coordinates);
          return { marker, body };
        }
        const parts = verdictBreakdown(item.counts).map(([status, n]) => [statusWords[status], n] as [string, number]);
        const { element, body } = clusterElement(item, t.cluster(item.count, parts));
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          // Read on tap: a new set of points rebuilds the index under a marker that stays.
          const entry = markers.get(item.key);
          if (!entry || entry.item.kind !== "cluster") return;
          // The map's padding (the panel, the overlays) keeps the cluster in the visible part. With less motion it jumps.
          map.easeTo({
            center: entry.item.coordinates,
            zoom: Math.min(expansionZoom(entry.index, entry.item.clusterId), map.getMaxZoom()),
            duration: motionMs(MOTION.camera),
          });
          announce(t.zoomedToCluster(item.count, parts));
        });
        const marker = new Marker({ element }).setLngLat(item.coordinates);
        return { marker, body };
      };

      // Where a marker is drawn on screen: its spot plus its offset in a ring of pins sharing one spot.
      const screen = (item: MapItem) => {
        const { x, y } = map.project(item.coordinates);
        const [dx, dy] = item.kind === "place" ? item.offset : [0, 0];
        return { x: x + dx, y: y + dy };
      };

      const refreshMarkers = () => {
        const bounds = map.getBounds();
        const padLon = (bounds.getEast() - bounds.getWest()) * VIEW_MARGIN;
        const padLat = (bounds.getNorth() - bounds.getSouth()) * VIEW_MARGIN;
        // A margin around the view: a short pan reveals pins that are already there (a longer one refreshes on the way).
        const bbox: [number, number, number, number] = [
          Math.max(-180, bounds.getWest() - padLon),
          Math.max(-85, bounds.getSouth() - padLat),
          Math.min(180, bounds.getEast() + padLon),
          Math.min(85, bounds.getNorth() + padLat),
        ];
        const items = mapItems(index, bbox, map.getZoom());
        const next = new Map(items.map((item) => [item.key, item]));
        const gone = [...markers.values()].filter((entry) => !next.has(entry.item.key));
        const added = items.filter((item) => !markers.has(item.key));
        for (const entry of markers.values()) {
          const item = next.get(entry.item.key);
          if (!item) continue;
          if (entry.index !== index) {
            entry.index = index;
            entry.leaves = undefined;
          }
          if (item.kind === "place") entry.marker.setOffset(item.offset);
          entry.item = item;
        }
        const spot = (item: MapItem): MarkerSpot => ({
          key: item.key,
          at: screen(item),
          count: item.kind === "cluster" ? item.count : 1,
        });
        const moves = markerMoves(
          gone.map((entry) => spot(entry.item)),
          added.map(spot),
        );
        const reduced = reducedMotion();
        const { clientWidth: width, clientHeight: height } = map.getContainer();
        // Each side its own budget: the entering children flying out are what the eye follows.
        const budget = { enter: MAX_TRANSITIONS, leave: MAX_TRANSITIONS / 2 };
        const animate = (body: HTMLElement, direction: "enter" | "leave", at: { x: number; y: number }, partner?: { x: number; y: number }) => {
          if (budget[direction] <= 0 || !nearView(at, width, height)) return null;
          budget[direction]--;
          const offset: [number, number] | null = partner ? [partner.x - at.x, partner.y - at.y] : null;
          const { keyframes, options } = markerTransition(direction, offset, reduced);
          return body.animate(keyframes, options);
        };
        for (const entry of gone) {
          markers.delete(entry.item.key);
          retire(entry.marker, leaving, animate(entry.body, "leave", screen(entry.item), moves.to.get(entry.item.key)));
        }
        for (const item of added) {
          const { marker, body } = create(item);
          marker.addTo(map);
          markers.set(item.key, { marker, body, item, index });
          animate(body, "enter", screen(item), moves.from.get(item.key));
        }
        markSelected(markers, selectedIdRef.current);
      };

      const update = (cameraMoved: boolean) => {
        const bounds = map.getBounds();
        onViewChangeRef.current?.([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()], cameraMoved);
        // Counted in the visible part only: the map runs on under the panel and the search.
        const { clientWidth: width, clientHeight: height } = map.getContainer();
        const pad = currentPadding(map);
        const sw = map.unproject([pad.left, height - pad.bottom]);
        const ne = map.unproject([width - pad.right, pad.top]);
        setInView(placesInView(index, [sw.lng, sw.lat, ne.lng, ne.lat]));
        refreshMarkers();
      };

      let level = clusterZoom(map.getZoom());
      let lastRefresh = 0;
      const follow = () => {
        const now = performance.now();
        const nextLevel = clusterZoom(map.getZoom());
        if (nextLevel === level && now - lastRefresh < PAN_REFRESH_MS) return;
        level = nextLevel;
        lastRefresh = now;
        refreshMarkers();
      };
      update(false);
      const moved = () => update(true);
      map.on("move", follow);
      map.on("moveend", moved);
      detach = () => {
        map.off("move", follow);
        map.off("moveend", moved);
      };
    });
    return () => {
      cancelled = true;
      detach?.();
    };
  }, [map, index, announce, t, statusWords, category]);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    import("maplibre-gl").then(({ LngLatBounds }) => {
      if (cancelled) return;
      if (centered) {
        fittedRef.current = null;
        return;
      }
      const fitted = fitTo ?? places;
      const key = fitKey === undefined ? fitted.map((place) => place.id).toSorted().join(",") : fitKey;
      if (!fitted.length || key === null || key === fittedRef.current) return;
      fittedRef.current = key;
      const bounds = new LngLatBounds();
      for (const place of fitted) bounds.extend(place.location.coordinates as [number, number]);
      // New results replace whatever the camera was doing, so the fit always sees the current padding.
      map.stop();
      applyPadding(map, paddingFor(map));
      // On top of the map's padding (the overlays and the panel): room for a pin on the left, the zoom buttons on the right.
      map.fitBounds(bounds, {
        padding: { top: 0, bottom: 0, left: 48, right: 72 },
        maxZoom: 16,
        duration: motionMs(MOTION.camera),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [map, places, fitTo, fitKey, centered, paddingFor]);

  useEffect(() => {
    if (!map || youLon === undefined || youLat === undefined) return;
    let marker: Marker | null = null;
    let cancelled = false;
    import("maplibre-gl").then(({ Marker }) => {
      if (cancelled) return;
      marker = new Marker({ element: youElement(youLabel), anchor: "bottom" }).setLngLat([youLon, youLat]).addTo(map);
      map.easeTo({
        center: [youLon, youLat],
        zoom: Math.max(map.getZoom(), config.initialZoom),
        padding: paddingFor(map)(),
        duration: motionMs(MOTION.camera),
      });
    });
    return () => {
      cancelled = true;
      marker?.remove();
    };
  }, [map, youLon, youLat, youLabel, paddingFor]);

  // The panel changed height (or the map its size): the visible area moves, the map doesn't. Only what the
  // panel now hides is brought back into view: the selected place, or else the user's position.
  useEffect(() => {
    if (!map) return;
    const sync = () => {
      const selected = revealSelected ? placesRef.current.find((place) => place.id === selectedIdRef.current) : undefined;
      const target = selected ? (selected.location.coordinates as [number, number]) : youLon !== undefined && youLat !== undefined ? ([youLon, youLat] as [number, number]) : null;
      // A point the visitor had already panned away from stays away.
      const wasInView = target !== null && !map.isMoving() && pointInView(map, target);
      applyPadding(map, paddingFor(map));
      if (target && wasInView) revealPoint(map, target);
    };
    // Out of React's commit: a camera change redraws the markers, which render React roots synchronously.
    const frame = requestAnimationFrame(sync);
    map.on("resize", sync);
    return () => {
      cancelAnimationFrame(frame);
      map.off("resize", sync);
    };
  }, [map, paddingFor, revealSelected, inset, padding.top, padding.bottom, youLon, youLat]);

  // A place picked in the list is eased into view when the panel or the overlays hide it.
  useEffect(() => {
    if (!map || !revealSelected || !selectedId) return;
    const selected = placesRef.current.find((place) => place.id === selectedId);
    if (!selected) return;
    const frame = requestAnimationFrame(() => revealPoint(map, selected.location.coordinates as [number, number]));
    return () => cancelAnimationFrame(frame);
  }, [map, revealSelected, selectedId]);

  useEffect(() => {
    markSelected(markersRef.current, selectedId);
  }, [selectedId]);

  return (
    <div
      className={cn(
        "relative size-full bg-muted [&_.maplibregl-canvas:focus-visible]:outline-3 [&_.maplibregl-canvas:focus-visible]:-outline-offset-4 [&_.maplibregl-canvas:focus-visible]:outline-ring",
        className,
      )}
    >
      <div ref={containerRef} className="absolute inset-0 size-full" />
      {/* Read as the canvas's description only: `hidden` keeps it out of the page text. */}
      <p id={descriptionId} hidden>
        {inView === null ? "" : t.inView(inView)}
      </p>
      {unavailable ? (
        <p role="status" className="absolute inset-x-4 top-1/3 rounded-2xl bg-card p-4 text-body-sm shadow-soft">
          {t.unavailable}
        </p>
      ) : null}
      <MapControls map={map} className={controlsClassName} />
    </div>
  );
}
