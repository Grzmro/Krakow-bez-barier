import { intlLocale, type Locale } from "@/i18n/locale";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const formats = new Map<Locale, Intl.RelativeTimeFormat>();

/** "20 min temu", "za 47 godz.", "2 dni temu": how far `iso` is from `now`, in the largest unit that keeps it readable. */
export function relativeTime(iso: string, now: Date, locale: Locale): string {
  let format = formats.get(locale);
  if (!format) {
    format = new Intl.RelativeTimeFormat(intlLocale[locale], { numeric: "auto", style: "short" });
    formats.set(locale, format);
  }
  const diff = Date.parse(iso) - now.getTime();
  const abs = Math.abs(diff);
  if (abs < MINUTE) return format.format(0, "second");
  if (abs < HOUR) return format.format(Math.round(diff / MINUTE), "minute");
  if (abs < 48 * HOUR) return format.format(Math.round(diff / HOUR), "hour");
  return format.format(Math.round(diff / (24 * HOUR)), "day");
}
