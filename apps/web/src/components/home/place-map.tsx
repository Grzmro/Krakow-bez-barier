"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "@phosphor-icons/react";
import type { PlaceSummary } from "@krakow-bez-barier/contracts";
import { cn } from "@krakow-bez-barier/ui";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { pl } from "@/i18n/pl";
import { config, mapAttribution } from "@/lib/config";

const t = pl.home.map;

const PIN_CLASS =
  "grid size-8 cursor-pointer place-items-center rounded-full border-[3px] border-card bg-primary shadow-float transition-transform duration-150 data-[selected=true]:z-10 data-[selected=true]:scale-125 data-[selected=true]:bg-ink";

export interface PlaceMapProps {
  places: PlaceSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Space covered by overlays (search on top, map controls at the bottom), in px. */
  padding: { top: number; bottom: number };
  className?: string;
}

/**
 * MapLibre map with neutral pins (no profile → no verdict colours). Pins are mouse shortcuts only
 * and hidden from assistive tech: the list next to the map holds the same places.
 */
export function PlaceMap({ places, selectedId, onSelect, padding, className }: PlaceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const markersRef = useRef(new Map<string, Marker>());
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
        const element = document.createElement("div");
        element.className = PIN_CLASS;
        element.setAttribute("aria-hidden", "true");
        element.dataset.placeId = place.id;
        element.innerHTML = '<span class="size-2.5 rounded-full bg-card"></span>';
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectRef.current(place.id);
        });
        const [lon, lat] = place.location.coordinates;
        markers.set(place.id, new Marker({ element }).setLngLat([lon, lat]).addTo(map));
      }
      if (!places.length) return;
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
