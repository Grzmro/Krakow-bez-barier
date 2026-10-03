"use client";

import { cn } from "@krakow-bez-barier/ui";
import { Info, Minus, Plus } from "@phosphor-icons/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useId, useRef, useState } from "react";
import { useMessages } from "@/i18n/client";
import { mapAttribution } from "@/lib/config";

/** Map sources (OSM licence) collapsed into an "i" button, plus zoom buttons, laid over the bottom of a map. */
export function MapControls({ map, extraAttribution, className }: { map: MapLibreMap | null; extraAttribution?: string; className?: string }) {
  const t = useMessages().home.map;
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

  return (
    <div className={cn("pointer-events-none absolute inset-x-3 bottom-9 z-10 flex items-end justify-between gap-2 *:pointer-events-auto", className)}>
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
                <a href={item.href} target="_blank" rel="noreferrer" className="inline-block py-0.5 underline underline-offset-2">
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
  );
}
