import type { TransitDepartures, VehicleAccessibility } from "@krakow-bez-barier/contracts";
import type { Status } from "@krakow-bez-barier/ui";
import { intlLocale, type Locale } from "@/i18n/locale";

/** Radius the place card asks for; the copy names it too. */
export const DEPARTURES_RADIUS_M = 400;

/** Only the operator's word for this vehicle is green or red; a default flag and no data stay neutral. */
export const VEHICLE_STATUS: Record<VehicleAccessibility["state"], Status> = {
  accessible: "met",
  inaccessible: "barrier",
  unverified: "unknown",
  no_data: "unknown",
  declared: "unknown",
  conflict: "conflict",
};

const formats = new Map<string, Intl.DateTimeFormat>();
function format(locale: Locale, withDate: boolean): Intl.DateTimeFormat {
  const key = `${locale}:${withDate}`;
  let f = formats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(intlLocale[locale], {
      ...(withDate ? { day: "numeric", month: "numeric", year: "numeric" } : {}),
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Warsaw",
    });
    formats.set(key, f);
  }
  return f;
}

/** "20:21" in Kraków time. */
export const formatClock = (iso: string, locale: Locale) => format(locale, false).format(new Date(iso));

/** "3.10.2026, 20:16" in Kraków time — for data that may be older than today. */
export const formatDateTime = (iso: string, locale: Locale) => format(locale, true).format(new Date(iso));

/** What the card says above the stops: nothing for fresh live data, otherwise why the data isn't live. */
export function departuresNotice(
  data: TransitDepartures,
): "disabled" | "outage" | "outageNoData" | "stale" | "partial" | "recorded" | null {
  if (data.mode === "disabled") return "disabled";
  if (data.source.refreshStatus === "outage") return data.fetchedAt ? "outage" : "outageNoData";
  if (data.source.refreshStatus === "stale" && data.fetchedAt) return "stale";
  // Some feeds failed, the rest are fresh: the server names the missing part in `statusNote`.
  if (data.mode === "live" && data.source.statusNote) return "partial";
  if (data.mode === "recorded") return "recorded";
  return null;
}
