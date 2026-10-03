import type { SourceAdapter } from "./adapter";
import { osm } from "./adapters/osm";
import type { CityConfig } from "./cities/types";

export const adapters: Record<string, SourceAdapter<never>> = {
  [osm.meta.id]: osm as SourceAdapter<never>,
};

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
