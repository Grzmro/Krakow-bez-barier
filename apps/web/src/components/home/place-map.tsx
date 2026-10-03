"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Icon } from "@phosphor-icons/react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { PlaceSummary } from "@krakow-bez-barier/contracts";
import { cn, useAnnounce } from "@krakow-bez-barier/ui";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMessages } from "@/i18n/client";
import { useCategoryLookup } from "@/lib/categories";
import { config } from "@/lib/config";
import { blankMissingImages } from "@/lib/map-images";
import {
  buildClusterIndex,
  clusterPlaceIds,
  expansionZoom,
  mapItems,
  placesInView,
  verdictBreakdown,
  type MapItem,
} from "@/lib/map-clusters";
import { MapControls } from "../map/map-controls";
import { insidePadding, mapPadding, paddedCentre, type Padding } from "./map-padding";
import { clusterSize, PlaceCluster } from "./place-cluster";
import { PlacePin } from "./place-pin";

// The map fills a phone's screen; at 3x (iPhone) that canvas is ~3 Mpx redrawn every frame of a pan. 2x stays sharp.
const MAX_PIXEL_RATIO = 2;
const PIN_CLASS = "group relative size-9 cursor-pointer data-[selected=true]:z-10";

function pinElement(place: PlaceSummary, icon: Icon, title: string) {
  const element = document.createElement("div");
  element.className = PIN_CLASS;
  element.setAttribute("aria-hidden", "true");
  element.title = title;
  element.dataset.placeId = place.id;
  element.dataset.category = place.category;
  if (place.verdict) element.dataset.status = place.verdict.state;
  const root = createRoot(element);
  flushSync(() => root.render(<PlacePin status={place.verdict?.state ?? null} icon={icon} />));
  return { element, root };
}

function clusterElement(item: Extract<MapItem, { kind: "cluster" }>, label: string) {
  const element = document.createElement("div");
  const size = clusterSize(item.count);
  element.className = "group relative cursor-pointer data-[selected=true]:z-10";
  element.style.width = element.style.height = `${size}px`;
  // Not a tab stop, like the pins: keyboard users zoom with +/- or the arrows, and the list holds every place.
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", label);
  element.title = label;
  const breakdown = verdictBreakdown(item.counts);
  element.dataset.clusterCount = String(item.count);
  element.dataset.verdicts = breakdown.map(([status, n]) => `${status}:${n}`).join(" ");
  const root = createRoot(element);
  flushSync(() => root.render(<PlaceCluster count={item.count} breakdown={breakdown} />));
  return { element, root };
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

/** `places` = the ids a marker stands for: one for a pin, every leaf for a cluster. */
type Markers = Map<string, { marker: Marker; root: Root; places: ReadonlySet<string> }>;

/** Marks the pin of the selected place, or the cluster that holds it. */
function markSelected(markers: Markers, selectedId: string | null) {
  for (const { marker, places } of markers.values()) {
    marker.getElement().dataset.selected = String(selectedId !== null && places.has(selectedId));
  }
}

function removeMarkers(markers: Markers, keys: Iterable<string> = [...markers.keys()]) {
  const roots: Root[] = [];
  for (const key of [...keys]) {
    const entry = markers.get(key);
    if (!entry) continue;
    entry.marker.remove();
    roots.push(entry.root);
    markers.delete(key);
  }
  // Unmounting synchronously from inside a React commit warns; defer it.
  queueMicrotask(() => roots.forEach((root) => root.unmount()));
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
  map.easeTo({ center: target, duration: 300 });
}

export interface PlaceMapProps {
  places: PlaceSummary[];
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
 * DOM marker. Pins are mouse shortcuts only and hidden from assistive tech: the list next to the map
 * holds the same places, and the canvas's description gives the number of places in view.
 */
export function PlaceMap({
  places,
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
  const index = useMemo(() => buildClusterIndex(places), [places]);
  const fittedRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const paddingRef = useRef(padding);
  const insetRef = useRef(inset);
  const selectedIdRef = useRef(selectedId);
  const placesRef = useRef(places);
  const [youLon, youLat] = you ?? [];
  const centered = Boolean(you);
  useEffect(() => {
    onSelectRef.current = onSelect;
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
      removeMarkers(markers);
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

  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    let update: (() => void) | null = null;
    const markers = markersRef.current;
    import("maplibre-gl").then(({ Marker }) => {
      if (cancelled) return;
      removeMarkers(markers);
      update = () => {
        const bounds = map.getBounds();
        const padLon = bounds.getEast() - bounds.getWest();
        const padLat = bounds.getNorth() - bounds.getSouth();
        // One viewport of margin on each side: a pan reveals pins that are already there.
        const bbox: [number, number, number, number] = [
          Math.max(-180, bounds.getWest() - padLon),
          Math.max(-85, bounds.getSouth() - padLat),
          Math.min(180, bounds.getEast() + padLon),
          Math.min(85, bounds.getNorth() + padLat),
        ];
        // Counted in the visible part only: the map runs on under the panel and the search.
        const { clientWidth: width, clientHeight: height } = map.getContainer();
        const pad = currentPadding(map);
        const sw = map.unproject([pad.left, height - pad.bottom]);
        const ne = map.unproject([width - pad.right, pad.top]);
        setInView(placesInView(index, [sw.lng, sw.lat, ne.lng, ne.lat]));
        const items = mapItems(index, bbox, map.getZoom());
        const keys = new Set(items.map((item) => item.key));
        removeMarkers(markers, [...markers.keys()].filter((key) => !keys.has(key)));
        for (const item of items) {
          if (markers.has(item.key)) continue;
          if (item.kind === "place") {
            const { place } = item;
            const { label: categoryLabel, icon } = category(place.category);
            const status = place.verdict ? statusWords[place.verdict.state] : null;
            const { element, root } = pinElement(place, icon, t.pin(place.name, categoryLabel, status));
            element.addEventListener("click", (event) => {
              event.stopPropagation();
              onSelectRef.current(place.id);
            });
            const marker = new Marker({ element, offset: item.offset }).setLngLat(item.coordinates).addTo(map);
            markers.set(item.key, { marker, root, places: new Set([place.id]) });
          } else {
            const parts = verdictBreakdown(item.counts).map(([status, n]) => [statusWords[status], n] as [string, number]);
            const { element, root } = clusterElement(item, t.cluster(item.count, parts));
            element.addEventListener("click", (event) => {
              event.stopPropagation();
              map.easeTo({
                center: item.coordinates,
                zoom: Math.min(expansionZoom(index, item.clusterId), map.getMaxZoom()),
                duration: 400,
              });
              announce(t.zoomedToCluster(item.count, parts));
            });
            const marker = new Marker({ element }).setLngLat(item.coordinates).addTo(map);
            markers.set(item.key, { marker, root, places: new Set(clusterPlaceIds(index, item.clusterId)) });
          }
        }
        markSelected(markers, selectedIdRef.current);
      };
      update();
      map.on("moveend", update);
    });
    return () => {
      cancelled = true;
      if (update) map.off("moveend", update);
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
      const key = places.map((place) => place.id).toSorted().join(",");
      if (!places.length || key === fittedRef.current) return;
      fittedRef.current = key;
      const bounds = new LngLatBounds();
      for (const place of places) bounds.extend(place.location.coordinates as [number, number]);
      // New results replace whatever the camera was doing, so the fit always sees the current padding.
      map.stop();
      applyPadding(map, paddingFor(map));
      // On top of the map's padding (the overlays and the panel): room for a pin on the left, the zoom buttons on the right.
      map.fitBounds(bounds, {
        padding: { top: 0, bottom: 0, left: 48, right: 72 },
        maxZoom: 16,
        duration: 400,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [map, places, centered, paddingFor]);

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
        duration: 400,
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
