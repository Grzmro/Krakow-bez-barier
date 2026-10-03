import { intlLocale, type Locale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";

/** Offline banner text for the moment the shown page was cached (ISO string, or null when this page has no cached copy). */
export function offlineMessage(cachedAt: string | null, locale: Locale): string {
  const t = messagesFor(locale).pwa.offline;
  const dateFormat = new Intl.DateTimeFormat(intlLocale[locale], {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  });
  const date = cachedAt ? new Date(cachedAt) : null;
  if (!date || Number.isNaN(date.getTime())) return t.noCopy;
  return t.withDate(dateFormat.format(date));
}
