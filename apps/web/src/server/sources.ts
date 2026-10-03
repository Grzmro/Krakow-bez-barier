import type { components } from "@krakow-bez-barier/contracts";
import { sources } from "@krakow-bez-barier/db";
import { getDb } from "./db";

export type Source = components["schemas"]["Source"];
type SourceRow = typeof sources.$inferSelect;

const HOUR_MS = 3_600_000;
const INTERVAL_MS: Partial<Record<string, number>> = {
  hourly: HOUR_MS,
  daily: 24 * HOUR_MS,
  weekly: 7 * 24 * HOUR_MS,
  monthly: 30 * 24 * HOUR_MS,
  yearly: 365 * 24 * HOUR_MS,
};
/** A successful source is "stale" once it has missed this many refresh intervals. */
const STALE_AFTER_INTERVALS = 2;

export const SIMULATED_OUTAGE_NOTE =
  "Symulowana awaria źródła (przełącznik testowy). Pokazujemy ostatnie znane dane jako nieaktualne.";
const OVERDUE_NOTE = "Źródło nie odświeżało się o czasie. Dane mogą być nieaktualne.";

/** Source ids from `SIMULATE_SOURCE_OUTAGE` (comma separated). Operator-only config, never a request input. */
export function simulatedOutageIds(env: Record<string, string | undefined> = process.env): string[] {
  return (env.SIMULATE_SOURCE_OUTAGE ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function toSource(row: SourceRow, now: Date, simulated: readonly string[] = []): Source {
  let { refreshStatus, statusNote, lastAttemptAt } = row;

  if (simulated.includes(row.id)) {
    refreshStatus = "outage";
    statusNote = SIMULATED_OUTAGE_NOTE;
    lastAttemptAt = now;
  } else if (refreshStatus === "ok" && row.lastSuccessAt) {
    const interval = row.refreshInterval ? INTERVAL_MS[row.refreshInterval] : undefined;
    if (interval && now.getTime() - row.lastSuccessAt.getTime() > interval * STALE_AFTER_INTERVALS) {
      refreshStatus = "stale";
      statusNote ??= OVERDUE_NOTE;
    }
  }

  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    license: row.license,
    attribution: row.attribution,
    url: row.url,
    refreshInterval: row.refreshInterval,
    refreshStatus,
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastAttemptAt: lastAttemptAt?.toISOString() ?? null,
    statusNote,
    isSample: row.isSample,
  };
}

export async function listSources(
  load: () => Promise<SourceRow[]> = () => getDb().select().from(sources).orderBy(sources.name),
  now: Date = new Date(),
  simulated: readonly string[] = simulatedOutageIds(),
): Promise<Source[]> {
  return (await load()).map((row) => toSource(row, now, simulated));
}
