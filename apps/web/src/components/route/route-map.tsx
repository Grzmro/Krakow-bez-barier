"use client";

import { useEffect, useRef, useState } from "react";
import type { Route } from "@krakow-bez-barier/contracts";
import { cn } from "@krakow-bez-barier/ui";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMessages } from "@/i18n/client";
import { config } from "@/lib/config";
import { blankMissingImages } from "@/lib/map-images";
import { MapControls } from "../map/map-controls";

const SOURCE = "route";
const ENDS = "route-ends";

// Layer colours come from the theme tokens, read once the map exists (they differ in dark mode).
function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function routeData(route: Route, selected: number | null) {
  return {
    type: "FeatureCollection" as const,
    features: route.segments.map((segment) => ({
      type: "Feature" as const,
      properties: { id: segment.id, state: segment.state, selected: segment.id === selected, dim: selected !== null && segment.id !== selected },
      geometry: segment.geometry,
    })),
  };
}

function endsData(route: Route) {
  const coordinates = route.geometry.coordinates;
  return {
    type: "FeatureCollection" as const,
    features: [
      { type: "Feature" as const, properties: { end: "start" }, geometry: { type: "Point" as const, coordinates: coordinates[0] } },
      { type: "Feature" as const, properties: { end: "end" }, geometry: { type: "Point" as const, coordinates: coordinates.at(-1)! } },
    ],
  };
}

function addLayers(map: MapLibreMap, route: Route, selected: number | null) {
  const color = (state: string) => token(`--status-${state}`);
  map.addSource(SOURCE, { type: "geojson", data: routeData(route, selected) });
  map.addSource(ENDS, { type: "geojson", data: endsData(route) });
  const width = ["case", ["get", "selected"], 9, 6] as const;
  const opacity = ["case", ["get", "dim"], 0.35, 1] as const;
  map.addLayer({
    id: "route-casing",
    type: "line",
    source: SOURCE,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": token("--card"), "line-width": ["+", width, 4] as never },
  });
  map.addLayer({
    id: "route-known",
    type: "line",
    source: SOURCE,
    filter: ["!=", ["get", "state"], "unknown"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["match", ["get", "state"], "met", color("met"), "barrier", color("barrier"), color("conflict")],
      "line-width": width as never,
      "line-opacity": opacity as never,
    },
  });
  // Unknown is dashed and grey, never a status colour: missing data must not look like a pass.
  map.addLayer({
    id: "route-unknown",
    type: "line",
    source: SOURCE,
    filter: ["==", ["get", "state"], "unknown"],
    layout: { "line-join": "round" },
    paint: { "line-color": color("unknown"), "line-width": width as never, "line-opacity": opacity as never, "line-dasharray": [1, 1] },
  });
  map.addLayer({
    id: "route-ends",
    type: "circle",
    source: ENDS,
    paint: {
      "circle-radius": 8,
      "circle-color": ["match", ["get", "end"], "start", token("--ink"), token("--primary")],
      "circle-stroke-color": token("--card"),
      "circle-stroke-width": 3,
    },
  });
}

export interface RouteMapProps {
  route: Route | undefined;
  selected: number | null;
  onSelect: (id: number | null) => void;
  /** Space covered by overlays (route card on top, sheet at the bottom), in px. */
  padding: { top: number; bottom: number };
  /** The walker's position (`[lon, lat]`) while guiding: a "Ty" marker. */
  you?: [number, number] | null;
  /** Keep the map centred on `you`. */
  follow?: boolean;
  className?: string;
}

/**
 * The route on a MapLibre map, segments coloured by state. A mouse shortcut only: the same segments, in the
 * same order, are the "Krok po kroku" list.
 */
export function RouteMap({ route, selected, onSelect, padding, you = null, follow = false, className }: RouteMapProps) {
  const t = useMessages().route.map;
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const onSelectRef = useRef(onSelect);
  const fittedRef = useRef<Route | null>(null);
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
        });
        instance.touchZoomRotate.disableRotation();
        blankMissingImages(instance);
        instance.once("load", () => !disposed && setLoaded(true));
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

  // MapLibre names the canvas once, at creation; this keeps it in the current language.
  useEffect(() => {
    map?.getCanvas().setAttribute("aria-label", t.label);
  }, [map, t.label]);

  useEffect(() => {
    if (!map || !loaded) return;
    const source = map.getSource<GeoJSONSource>(SOURCE);
    if (!route) {
      // A failed request must not leave the previous route drawn as if it were this one.
      source?.setData({ type: "FeatureCollection", features: [] });
      map.getSource<GeoJSONSource>(ENDS)?.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    if (source) {
      source.setData(routeData(route, selected));
      map.getSource<GeoJSONSource>(ENDS)?.setData(endsData(route));
    } else {
      addLayers(map, route, selected);
      for (const layer of ["route-known", "route-unknown"]) {
        map.on("click", layer, (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "number") onSelectRef.current(id);
        });
      }
    }
    if (fittedRef.current === route) return;
    fittedRef.current = route;
    import("maplibre-gl").then(({ LngLatBounds }) => {
      const bounds = new LngLatBounds();
      for (const point of route.geometry.coordinates) bounds.extend(point as [number, number]);
      map.fitBounds(bounds, { padding: { top: padding.top, bottom: padding.bottom, left: 32, right: 72 }, duration: 400 });
    });
  }, [map, loaded, route, selected, padding.top, padding.bottom]);

  const youRef = useRef<Marker | null>(null);
  const [lon, lat] = you ?? [];
  useEffect(() => {
    if (!map || !loaded || lon === undefined || lat === undefined) {
      youRef.current?.remove();
      youRef.current = null;
      return;
    }
    let cancelled = false;
    import("maplibre-gl").then(({ Marker }) => {
      if (cancelled) return;
      if (!youRef.current) {
        const element = document.createElement("div");
        element.setAttribute("aria-hidden", "true");
        element.className =
          "grid size-9 place-items-center rounded-full bg-ink text-[11px] font-bold text-ink-foreground shadow-float ring-4 ring-card";
        youRef.current = new Marker({ element }).setLngLat([lon, lat]).addTo(map);
      }
      youRef.current.getElement().textContent = t.you;
      youRef.current.setLngLat([lon, lat]);
      // Padding keeps the marker clear of the route card on top and the panel below.
      if (follow) map.easeTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 17), offset: [0, (padding.top - padding.bottom) / 2], duration: 400 });
    });
    return () => {
      cancelled = true;
    };
  }, [map, loaded, lon, lat, follow, padding.top, padding.bottom, t.you]);
  useEffect(() => () => void youRef.current?.remove(), []);

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
      <MapControls map={map} extraAttribution={route?.attribution ? "openrouteservice" : undefined} />
    </div>
  );
}
