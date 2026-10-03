import { pl } from "@/i18n/pl";

const t = pl.pwa.offline;

const dateFormat = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Warsaw",
});

/** Offline banner text for the moment the shown page was cached (ISO string, or null). */
export function offlineMessage(cachedAt: string | null): string {
  const date = cachedAt ? new Date(cachedAt) : null;
  if (!date || Number.isNaN(date.getTime())) return t.noDate;
  return t.withDate(dateFormat.format(date));
}
