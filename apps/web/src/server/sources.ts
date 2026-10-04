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

type SourceText = Pick<Source, "id" | "kind" | "license" | "refreshStatus" | "statusNote">;

/**
 * Source ids switched off by config (`WITHHELD_SOURCES`, comma separated), e.g. a source whose licence turns out to
 * be doubtful after it was loaded. Operator-only config, never a request input.
 */
export function withheldSourceIds(env: Record<string, string | undefined> = process.env): string[] {
  return (env.WITHHELD_SOURCES ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * A source whose facts the API never serves: its licence is still to be confirmed (ingest refuses to load such a
 * source, but a database may hold facts loaded before), or it is switched off in `WITHHELD_SOURCES`.
 */
export function isWithheld(source: Pick<SourceRow, "id" | "license">, withheld: readonly string[] = withheldSourceIds()): boolean {
  return PENDING_LICENSE.test(source.license) || withheld.includes(source.id);
}

/** A licence still being confirmed and user-report "licences" in the reader's language; a source's own licence as is. */
export function localizeLicense(source: Pick<Source, "kind" | "license">, locale: Locale = defaultLocale): string {
  const t = messagesFor(locale).pages.aboutData.licenseNote;
  if (PENDING_LICENSE.test(source.license)) return t.pending;
  return source.kind === "user_report" ? t.userReports : source.license;
}

/**
 * Swaps the internal licence and status wording of a source for copy in the reader's language: a licence still
 * being confirmed, user-report "licences" and seed notes; a source never fetched gets a note saying why, and a
 * withheld one (see `isWithheld`) says that its data is not shown and why.
 */
export function localizeSourceText<T extends SourceText>(
  source: T,
  locale: Locale = defaultLocale,
  withheld: readonly string[] = withheldSourceIds(),
): T {
  const t = messagesFor(locale).pages.aboutData;
  const pending = PENDING_LICENSE.test(source.license);
  const license = localizeLicense(source, locale);
  let statusNote = source.statusNote;
  if (statusNote && SEEDED_NOTE.test(statusNote)) statusNote = t.statusNote.seeded;
  const reason = t.statusNote.withheldBySource[source.id];
  if (isWithheld(source, withheld) && (reason || source.refreshStatus !== "never" || !pending)) {
    statusNote = reason ?? t.statusNote.withheld;
  } else if (!statusNote && source.refreshStatus === "never") {
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

/** The row as the simulated outage shows it: failed now, its last success and data kept. Other rows pass through. */
export function withSimulatedOutage(
  row: SourceRow,
  now: Date,
  simulated: readonly string[],
  locale: Locale = defaultLocale,
): SourceRow {
  if (!simulated.includes(row.id)) return row;
  const notes = messagesFor(locale).pages.aboutData.statusNote;
  return { ...row, refreshStatus: "outage", statusNote: notes.simulatedOutage, lastAttemptAt: now };
}

export function toSource(row: SourceRow, now: Date, simulated: readonly string[] = [], locale: Locale = defaultLocale): Source {
  const notes = messagesFor(locale).pages.aboutData.statusNote;
  const overlaid = withSimulatedOutage(row, now, simulated, locale);
  let { refreshStatus, statusNote } = overlaid;

  if (refreshStatus === "ok" && row.lastSuccessAt) {
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
    lastAttemptAt: overlaid.lastAttemptAt?.toISOString() ?? null,
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
