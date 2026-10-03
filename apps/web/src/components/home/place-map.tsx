"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { PlaceSummary } from "@krakow-bez-barier/contracts";
import { cn } from "@krakow-bez-barier/ui";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMessages } from "@/i18n/client";
import { config } from "@/lib/config";
import { MapControls } from "../map/map-controls";
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

function removeMarkers(markers: Map<string, { marker: Marker; root: Root }>) {
  const roots = [...markers.values()].map(({ marker, root }) => {
    marker.remove();
    return root;
  });
  markers.clear();
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
 * MapLibre map with neutral pins, or verdict pins when a profile is on. Pins are mouse shortcuts only
 * and hidden from assistive tech: the list next to the map holds the same places.
 */
export function PlaceMap({ places, selectedId, onSelect, padding, you = null, label, className }: PlaceMapProps) {
  const messages = useMessages();
  const t = messages.home.map;
  const youLabel = messages.nearby.home.you;
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const markersRef = useRef(new Map<string, { marker: Marker; root: Root }>());
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
    const markers = markersRef.current;
    import("maplibre-gl").then(({ Marker, LngLatBounds }) => {
      if (cancelled) return;
      removeMarkers(markers);
      for (const place of places) {
        const { element, root } = pinElement(place);
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectRef.current(place.id);
        });
        const [lon, lat] = place.location.coordinates;
        element.dataset.selected = String(place.id === selectedIdRef.current);
        markers.set(place.id, { marker: new Marker({ element }).setLngLat([lon, lat]).addTo(map), root });
      }
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
    for (const [id, { marker }] of markersRef.current) {
      marker.getElement().dataset.selected = String(id === selectedId);
    }
  }, [selectedId, places, map]);

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
