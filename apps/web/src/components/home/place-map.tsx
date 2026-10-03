"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "@phosphor-icons/react";
import type { PlaceSummary } from "@krakow-bez-barier/contracts";
import { cn, type Status } from "@krakow-bez-barier/ui";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { pl } from "@/i18n/pl";
import { config, mapAttribution } from "@/lib/config";

const t = pl.home.map;

const PIN_CLASS =
  "group relative grid size-9 cursor-pointer place-items-center transition-transform duration-150 data-[selected=true]:z-10 data-[selected=true]:scale-125";
const PIN_RING = "absolute -inset-1 hidden rounded-full border-[3px] border-ink group-data-[selected=true]:block";

// Each verdict has its own shape as well as colour (octagon, diamond, dashed ring), like the
// status icons; the list beside the map carries the same verdict as text.
const PIN_SHAPE: Record<Status | "none", string> = {
  none: "size-8 rounded-full border-[3px] border-card bg-primary shadow-float",
  met: "size-8 rounded-full border-[3px] border-card bg-status-met shadow-float",
  barrier:
    "size-8 bg-status-barrier shadow-float [clip-path:polygon(30%_0,70%_0,100%_30%,100%_70%,70%_100%,30%_100%,0_70%,0_30%)]",
  conflict: "size-6 rotate-45 rounded-[5px] border-[3px] border-card bg-status-conflict shadow-float",
  unknown: "size-8 rounded-full border-[2.5px] border-dashed border-status-unknown bg-status-unknown-bg shadow-float",
};
const PIN_DOT: Record<Status | "none", string> = {
  none: "size-2.5 rounded-full bg-card",
  met: "size-2.5 rounded-full bg-card",
  barrier: "h-1 w-3.5 rounded-full bg-card",
  conflict: "size-2 rounded-full bg-card",
  unknown: "size-2 rounded-full bg-status-unknown",
};

function pinElement(place: PlaceSummary) {
  const status = place.verdict?.state ?? "none";
  const element = document.createElement("div");
  element.className = PIN_CLASS;
  element.setAttribute("aria-hidden", "true");
  element.dataset.placeId = place.id;
  if (place.verdict) element.dataset.status = place.verdict.state;
  const ring = document.createElement("span");
  ring.className = PIN_RING;
  const shape = document.createElement("span");
  shape.className = `grid place-items-center ${PIN_SHAPE[status]}`;
  const dot = document.createElement("span");
  dot.className = `${PIN_DOT[status]}${status === "conflict" ? " -rotate-45" : ""}`;
  shape.append(dot);
  element.append(ring, shape);
  return element;
}

export interface PlaceMapProps {
  places: PlaceSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Space covered by overlays (search on top, map controls at the bottom), in px. */
  padding: { top: number; bottom: number };
  className?: string;
}

/**
 * MapLibre map with neutral pins, or verdict pins when a profile is on. Pins are mouse shortcuts only
 * and hidden from assistive tech: the list next to the map holds the same places.
 */
export function PlaceMap({ places, selectedId, onSelect, padding, className }: PlaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const markersRef = useRef(new Map<string, Marker>());
  const fittedRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let disposed = false;
    let instance: MapLibreMap | null = null;
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
          locale: { "Map.Title": t.label },
        });
        instance.touchZoomRotate.disableRotation();
        setMap(instance);
      })
      .catch(() => {
        if (!disposed) setUnavailable(true);
      });
    return () => {
      disposed = true;
      instance?.remove();
    };
  }, []);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const markers = markersRef.current;
    import("maplibre-gl").then(({ Marker, LngLatBounds }) => {
      if (cancelled) return;
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      for (const place of places) {
        const element = pinElement(place);
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectRef.current(place.id);
        });
        const [lon, lat] = place.location.coordinates;
        markers.set(place.id, new Marker({ element }).setLngLat([lon, lat]).addTo(map));
      }
      const key = places.map((place) => place.id).toSorted().join(",");
      if (!places.length || key === fittedRef.current) return;
      fittedRef.current = key;
      const bounds = new LngLatBounds();
      for (const place of places) bounds.extend(place.location.coordinates as [number, number]);
      map.fitBounds(bounds, {
        padding: { top: padding.top, bottom: padding.bottom, left: 48, right: 72 },
        maxZoom: 16,
        duration: 400,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [map, places, padding.top, padding.bottom]);

  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
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
      <div className="absolute inset-x-3 bottom-9 z-10 flex items-end justify-between gap-2">
        <p className="min-w-0 rounded-full bg-card/90 px-2.5 py-1 text-[11px] leading-4 text-muted-foreground"
        >
          {mapAttribution.map((item, index) => (
            <span key={item.href}>
              {index > 0 ? " · " : null}
              <a href={item.href} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                {item.label}
              </a>
            </span>
          ))}
        </p>
        <div className="flex shrink-0 flex-col overflow-hidden rounded-full bg-card shadow-float">
          <button
            type="button"
            aria-label={t.zoomIn}
            disabled={!map}
            onClick={() => map?.zoomIn()}
            className="grid size-12 place-items-center hover:bg-muted"
          >
            <Plus weight="bold" className="size-5" aria-hidden />
          </button>
          <span aria-hidden className="mx-3 h-px bg-border" />
          <button
            type="button"
            aria-label={t.zoomOut}
            disabled={!map}
            onClick={() => map?.zoomOut()}
            className="grid size-12 place-items-center hover:bg-muted"
          >
            <Minus weight="bold" className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
