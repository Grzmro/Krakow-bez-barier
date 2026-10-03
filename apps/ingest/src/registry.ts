import type { SourceAdapter } from "./adapter";
import { msipToilets } from "./adapters/msip-toilets";
import { osm } from "./adapters/osm";
import { zdmkParkingOzn } from "./adapters/zdmk-parking-ozn";
import { ztpStops } from "./adapters/ztp-stops";
import type { CityConfig } from "./cities/types";

export const adapters: Record<string, SourceAdapter<never>> = Object.fromEntries(
  [osm, msipToilets, zdmkParkingOzn, ztpStops].map((a) => [a.meta.id, a as SourceAdapter<never>]),
);

export type RunTarget = { city: CityConfig; sourceIds: string[] } | { error: string };

/** Resolves `--city` / `--source` against the configured cities and registered adapters. */
export function resolveTarget(
  cities: Record<string, CityConfig>,
  cityId: string | undefined,
  sourceId?: string,
): RunTarget {
  const city = cityId ? cities[cityId] : undefined;
  if (!city) return { error: `Usage: npm run ingest -- --city <${Object.keys(cities).join("|")}> [--source <id>]` };
  const sourceIds = sourceId ? [sourceId] : city.sources;
  const unknown = sourceIds.filter((id) => !adapters[id] || !city.sources.includes(id));
  if (unknown.length > 0) return { error: `Source(s) not available for ${city.id}: ${unknown.join(", ")}` };
  return { city, sourceIds };
}
