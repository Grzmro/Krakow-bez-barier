import type { SourceAdapter } from "./adapter";
import { bipMk } from "./adapters/bip-mk";
import { msipToilets } from "./adapters/msip-toilets";
import { osm } from "./adapters/osm";
import { zdmkParkingOzn } from "./adapters/zdmk-parking-ozn";
import { ztpStops } from "./adapters/ztp-stops";
import type { CityConfig } from "./cities/types";

export const adapters: Record<string, SourceAdapter<never>> = Object.fromEntries(
  [osm, msipToilets, zdmkParkingOzn, ztpStops, bipMk].map((a) => [a.meta.id, a as SourceAdapter<never>]),
);

export type RunTarget = { city: CityConfig; sourceIds: string[] } | { error: string };

/**
 * Resolves `--city` / `--source` / `--area` against the configured cities and registered adapters.
 * With an area, the returned city's `bbox` is that area, so every adapter reads only it.
 */
export function resolveTarget(
  cities: Record<string, CityConfig>,
  cityId: string | undefined,
  sourceId?: string,
  areaId?: string,
): RunTarget {
  const configured = cityId ? cities[cityId] : undefined;
  if (!configured) {
    return { error: `Usage: npm run ingest -- --city <${Object.keys(cities).join("|")}> [--source <id>] [--area <name>]` };
  }
  let city = configured;
  if (areaId) {
    const area = configured.areas?.[areaId];
    if (!area) {
      const known = Object.keys(configured.areas ?? {});
      return { error: `Area "${areaId}" is not configured for ${configured.id}${known.length ? ` (known: ${known.join(", ")})` : ""}` };
    }
    city = { ...configured, bbox: area };
  }
  const sourceIds = sourceId ? [sourceId] : city.sources;
  const unknown = sourceIds.filter((id) => !adapters[id] || !city.sources.includes(id));
  if (unknown.length > 0) return { error: `Source(s) not available for ${city.id}: ${unknown.join(", ")}` };
  return { city, sourceIds };
}
