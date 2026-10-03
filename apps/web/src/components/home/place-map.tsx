"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { PlaceSummary } from "@krakow-bez-barier/contracts";
import { cn, useAnnounce } from "@krakow-bez-barier/ui";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMessages } from "@/i18n/client";
import { config } from "@/lib/config";
import {
  buildClusterIndex,
  clusterPlaceIds,
  expansionZoom,
  mapItems,
  verdictBreakdown,
  type MapItem,
} from "@/lib/map-clusters";
import { MapControls } from "../map/map-controls";
import { clusterSize, PlaceCluster } from "./place-cluster";
import { PlacePin } from "./place-pin";

const PIN_CLASS = "group relative size-9 cursor-pointer data-[selected=true]:z-10";

function pinElement(place: PlaceSummary) {
  const element = document.createElement("div");
  element.className = PIN_CLASS;
  element.setAttribute("aria-hidden", "true");
  element.dataset.placeId = place.id;
  if (place.verdict) element.dataset.status = place.verdict.state;
  const root = createRoot(element);
  flushSync(() => root.render(<PlacePin status={place.verdict?.state ?? null} />));
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

export interface PlaceMapProps {
  places: PlaceSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Space covered by overlays (search on top, map controls at the bottom), in px. */
  padding: { top: number; bottom: number };
  /** The user's position (`[lon, lat]`): shown as "Ty" and the map centres on it instead of fitting the places. */
  you?: [number, number] | null;
  /** Accessible name of the map; defaults to the home screen's ("... The list has the same places."). */
  label?: string;
  className?: string;
}

/**
 * MapLibre map with neutral pins, or verdict pins when a profile is on. Nearby pins merge into clusters
 * (a verdict donut with a profile); only what is in or near the viewport gets a DOM marker. Pins are
 * mouse shortcuts only and hidden from assistive tech: the list next to the map holds the same places.
 */
export function PlaceMap({ places, selectedId, onSelect, padding, you = null, label, className }: PlaceMapProps) {
  const messages = useMessages();
  const t = messages.home.map;
  const statusWords = messages.common.status;
  const announce = useAnnounce();
  const youLabel = messages.nearby.home.you;
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const markersRef = useRef<Markers>(new Map());
  const index = useMemo(() => buildClusterIndex(places), [places]);
  const fittedRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const paddingRef = useRef(padding);
  const selectedIdRef = useRef(selectedId);
  const [youLon, youLat] = you ?? [];
  const centered = Boolean(you);
  useEffect(() => {
    onSelectRef.current = onSelect;
    paddingRef.current = padding;
    selectedIdRef.current = selectedId;
  });

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
        });
        instance.touchZoomRotate.disableRotation();
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

  // MapLibre names the canvas once, at creation; this keeps it in the current language.
  useEffect(() => {
    map?.getCanvas().setAttribute("aria-label", label ?? t.label);
  }, [map, label, t.label]);

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
        const items = mapItems(index, bbox, map.getZoom());
        const keys = new Set(items.map((item) => item.key));
        removeMarkers(markers, [...markers.keys()].filter((key) => !keys.has(key)));
        for (const item of items) {
          if (markers.has(item.key)) continue;
          if (item.kind === "place") {
            const { place } = item;
            const { element, root } = pinElement(place);
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
                padding: { ...paddingRef.current, left: 0, right: 0 },
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
  }, [map, index, announce, t, statusWords]);

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
      map.fitBounds(bounds, {
        padding: { top: paddingRef.current.top, bottom: paddingRef.current.bottom, left: 48, right: 72 },
        maxZoom: 16,
        duration: 400,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [map, places, centered]);

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
        padding: { top: paddingRef.current.top, bottom: paddingRef.current.bottom, left: 0, right: 0 },
        duration: 400,
      });
    });
    return () => {
      cancelled = true;
      marker?.remove();
    };
  }, [map, youLon, youLat, youLabel]);

  // A padding change (the list panel being stowed) only moves the map's visible area; it never refits or recentres.
  useEffect(() => {
    if (map && centered) map.easeTo({ padding: { top: padding.top, bottom: padding.bottom, left: 0, right: 0 }, duration: 300 });
  }, [map, centered, padding.top, padding.bottom]);

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
      {unavailable ? (
        <p role="status" className="absolute inset-x-4 top-1/3 rounded-2xl bg-card p-4 text-body-sm shadow-soft">
          {t.unavailable}
        </p>
      ) : null}
      <MapControls map={map} />
    </div>
  );
}
