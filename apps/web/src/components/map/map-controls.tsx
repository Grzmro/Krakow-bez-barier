"use client";

import { Minus, Plus } from "@phosphor-icons/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { pl } from "@/i18n/pl";
import { mapAttribution } from "@/lib/config";

const t = pl.home.map;

/** Always-visible map attribution (OSM licence) and zoom buttons, laid over the bottom of a map. */
export function MapControls({ map, extraAttribution }: { map: MapLibreMap | null; extraAttribution?: string }) {
  return (
    <div className="absolute inset-x-3 bottom-9 z-10 flex items-end justify-between gap-2">
      <p className="min-w-0 rounded-full bg-card/90 px-2.5 py-1 text-[11px] leading-4 text-muted-foreground">
        {mapAttribution.map((item, index) => (
          <span key={item.href}>
            {index > 0 ? " · " : null}
            <a href={item.href} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {item.label}
            </a>
          </span>
        ))}
        {extraAttribution ? ` · ${extraAttribution}` : null}
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
  );
}
