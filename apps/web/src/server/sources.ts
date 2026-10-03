import type { components } from "@krakow-bez-barier/contracts";
import { sources } from "@krakow-bez-barier/db";
import { defaultLocale, type Locale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";
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

// Raw wording ingest and the seed write in English; never shown to readers as is.
const PENDING_LICENSE = /^to be confirmed\b/i;
const SEEDED_NOTE = /^seeded from\b/i;

type SourceText = Pick<Source, "kind" | "license" | "refreshStatus" | "statusNote">;

/**
 * Swaps the internal licence and status wording of a source for copy in the reader's language: a licence still
 * being confirmed, user-report "licences" and seed notes; a source never fetched gets a note saying why.
 */
export function localizeSourceText<T extends SourceText>(source: T, locale: Locale = defaultLocale): T {
  const t = messagesFor(locale).pages.aboutData;
  const pending = PENDING_LICENSE.test(source.license);
  const license = pending
    ? t.licenseNote.pending
    : source.kind === "user_report"
      ? t.licenseNote.userReports
      : source.license;
  let statusNote = source.statusNote;
  if (statusNote && SEEDED_NOTE.test(statusNote)) statusNote = t.statusNote.seeded;
  if (!statusNote && source.refreshStatus === "never") {
    statusNote = pending ? t.statusNote.awaitingLicense : t.statusNote.notFetched;
  }
  return { ...source, license, statusNote };
}

/**
 * Source ids from `SIMULATE_SOURCE_OUTAGE` (comma separated). Operator-only config, never a
 * request input; ignored in production unless `ALLOW_SIMULATED_OUTAGE=true` (the live demo).
 */
export function simulatedOutageIds(env: Record<string, string | undefined> = process.env): string[] {
  if (env.NODE_ENV === "production" && env.ALLOW_SIMULATED_OUTAGE !== "true") return [];
  return (env.SIMULATE_SOURCE_OUTAGE ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function toSource(row: SourceRow, now: Date, simulated: readonly string[] = [], locale: Locale = defaultLocale): Source {
  const notes = messagesFor(locale).pages.aboutData.statusNote;
  let { refreshStatus, statusNote, lastAttemptAt } = row;

  if (simulated.includes(row.id)) {
    refreshStatus = "outage";
    statusNote = notes.simulatedOutage;
    lastAttemptAt = now;
  } else if (refreshStatus === "ok" && row.lastSuccessAt) {
    const interval = row.refreshInterval ? INTERVAL_MS[row.refreshInterval] : undefined;
    if (interval && now.getTime() - row.lastSuccessAt.getTime() > interval * STALE_AFTER_INTERVALS) {
      refreshStatus = "stale";
      statusNote ??= notes.overdue;
    }
  }

  const source: Source = {
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
  return localizeSourceText(source, locale);
}

export async function listSources(
  load: () => Promise<SourceRow[]> = () => getDb().select().from(sources).orderBy(sources.name),
  now: Date = new Date(),
  simulated: readonly string[] = simulatedOutageIds(),
  locale: Locale = defaultLocale,
): Promise<Source[]> {
  return (await load()).map((row) => toSource(row, now, simulated, locale));
}
