"use client";

import { cn, MOTION, motionMs, useAnnounce } from "@krakow-bez-barier/ui";
import {
  CircleNotch,
  Crosshair,
  Info,
  Minus,
  Plus,
} from "@phosphor-icons/react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useId, useReducer, useRef, useState } from "react";
import { useMessages } from "@/i18n/client";
import { config, mapAttribution } from "@/lib/config";
import { locateMeIdle, locateMeReducer } from "@/lib/locate-me";
import { locateDevice } from "@/lib/native/geolocation";
import { locationSettings } from "@/lib/native/platform";
import { locateFailureText, toLonLat } from "@/lib/nearby";

/** Zoom the map reaches at least when it centres on the user (street level). */
const LOCATE_ZOOM = Math.max(config.initialZoom, 15);

function hereElement(label: string) {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  element.dataset.you = "true";
  element.className = "pointer-events-none flex flex-col items-center gap-1";
  const text = document.createElement("span");
  text.className =
    "rounded-full bg-ink px-2 py-0.5 text-caption font-semibold text-ink-foreground shadow-soft";
  text.textContent = label;
  const dot = document.createElement("span");
  dot.className =
    "size-5 rounded-full bg-primary ring-4 ring-card shadow-float";
  element.append(text, dot);
  return element;
}

/** Map sources (OSM licence) collapsed into an "i" button, plus zoom buttons, laid over the bottom of a map. */
export function MapControls({
  map,
  extraAttribution,
  className,
}: {
  map: MapLibreMap | null;
  extraAttribution?: string;
  className?: string;
}) {
  const messages = useMessages();
  const t = messages.home.map;
  const announce = useAnnounce();
  const [locate, dispatch] = useReducer(locateMeReducer, locateMeIdle);
  const hereRef = useRef<Marker | null>(null);
  const locateButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const locateMe = async () => {
    if (!map || locate.status === "locating") return;
    dispatch({ type: "start" });
    announce(t.locating);
    const result = await locateDevice();
    dispatch({ type: "finish", result });
    if (!result.ok) {
      const { message, help } = locateFailureText(
        result.reason,
        locationSettings(),
        messages.nearby,
      );
      announce([message, help].filter(Boolean).join(" "));
      return;
    }
    const center = toLonLat(result.position);
    map.easeTo({
      center,
      zoom: Math.max(map.getZoom(), LOCATE_ZOOM),
      duration: motionMs(MOTION.camera),
    });
    const { Marker } = await import("maplibre-gl");
    // One "you" marker: the home screen's own (a "W mojej okolicy" search) is already there.
    if (!map.getContainer().querySelector("[data-you]")) {
      hereRef.current?.remove();
      hereRef.current = new Marker({
        element: hereElement(t.here),
        anchor: "bottom",
      })
        .setLngLat(center)
        .addTo(map);
    }
    announce(t.located);
  };

  useEffect(() => () => void hereRef.current?.remove(), []);

  useEffect(() => {
    if (locate.status !== "failed") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      dispatch({ type: "dismiss" });
      locateButtonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [locate.status]);

  const failure =
    locate.status === "failed"
      ? locateFailureText(locate.reason, locationSettings(), messages.nearby)
      : null;
  const locating = locate.status === "locating";

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-3 bottom-9 z-10 flex items-end justify-between gap-2 *:pointer-events-auto",
        className,
      )}
    >
      <div ref={rootRef} className="relative min-w-0">
        <button
          ref={buttonRef}
          type="button"
          aria-label={t.sourcesLabel}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="grid size-8 place-items-center rounded-full bg-card/90 text-muted-foreground hover:bg-muted"
        >
          <Info weight="bold" className="size-4" aria-hidden />
        </button>
        {open ? (
          <p
            id={panelId}
            className="absolute bottom-full left-0 mb-2 w-max max-w-[min(18rem,calc(100vw-5rem))] rounded-2xl bg-card px-3 py-2 text-[11px] leading-5 text-muted-foreground shadow-float"
          >
            {mapAttribution.map((item, index) => (
              <span key={item.href}>
                {index > 0 ? " · " : null}
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block py-0.5 underline underline-offset-2"
                >
                  {item.label}
                </a>
              </span>
            ))}
            {extraAttribution ? ` · ${extraAttribution}` : null}
          </p>
        ) : (
          <p id={panelId} className="sr-only">
            {t.sources}: {mapAttribution.map((item) => item.label).join(", ")}
            {extraAttribution ? `, ${extraAttribution}` : null}
          </p>
        )}
      </div>
      <div className="relative flex shrink-0 flex-col items-end gap-2">
        {failure ? (
          <p className="absolute right-0 bottom-full mb-2 w-max max-w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl bg-card px-3 py-2 text-body-sm text-foreground shadow-float">
            {failure.message}
            {failure.help ? (
              <span className="mt-1 block text-muted-foreground">
                {failure.help}
              </span>
            ) : null}
          </p>
        ) : null}
        <button
          ref={locateButtonRef}
          type="button"
          aria-label={t.locate}
          aria-busy={locating}
          disabled={!map}
          onClick={() => void locateMe()}
          className="grid size-12 place-items-center rounded-full bg-card shadow-float hover:bg-muted"
        >
          {locating ? (
            <CircleNotch
              weight="bold"
              className="size-5 motion-safe:animate-spin"
              aria-hidden
            />
          ) : (
            <Crosshair weight="bold" className="size-5" aria-hidden />
          )}
        </button>
        <div className="flex flex-col overflow-hidden rounded-full bg-card shadow-float">
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
