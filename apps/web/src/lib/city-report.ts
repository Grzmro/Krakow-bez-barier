import type { AccessibilityAttribute, Outage, Place, ResolvedAttribute } from "@krakow-bez-barier/contracts";
import { isActiveOutage } from "@/domain/outages";
import type { Locale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";
import { factViews, formatDate } from "@/lib/place-facts";

/** Mail clients and OS handlers (iOS, older Android) drop `mailto:` links much longer than this. */
export const MAILTO_MAX_LENGTH = 2000;

const ADDRESS = /^[^\s@,;:?&=<>"]+@[^\s@,;:?&=<>"]+\.[^\s@,;:?&=<>"]+$/;

export interface CityReport {
  subject: string;
  body: string;
}

/** A known value that is a barrier whoever asks (not relative to a profile): steps at the entrance, no accessible toilet. */
function isKnownBarrier(resolved: ResolvedAttribute): boolean {
  if ((resolved.state !== "known" && resolved.state !== "stale") || !resolved.value) return false;
  const value = resolved.value;
  if (resolved.attribute === "step_count") return value.kind === "number" && value.number > 0;
  if (resolved.attribute === "toilet_accessible") return value.kind === "boolean" && !value.boolean;
  return false;
}

/** Attributes the report names: known barriers and conflicting sources (the city can settle those on site). */
export function reportableAttributes(place: Pick<Place, "attributes">): AccessibilityAttribute[] {
  return place.attributes.filter((a) => a.state === "conflict" || isKnownBarrier(a)).map((a) => a.attribute);
}

/** Whether the card has something worth reporting: an active outage, a known barrier or a conflict. */
export function hasReportableBarrier(place: Pick<Place, "attributes" | "outages">): boolean {
  return (place.outages ?? []).some(isActiveOutage) || reportableAttributes(place).length > 0;
}

/**
 * The ready-made report: place, address, coordinates, link and every reported barrier with its source, date and
 * reliability. No personal data: it holds only what the card shows; the visitor sends it from their own client.
 */
export function buildCityReport(input: { place: Place; url: string; locale: Locale; now?: Date }): CityReport {
  const { place, url, locale } = input;
  const now = input.now ?? new Date();
  const t = messagesFor(locale).place.cityReport.message;
  const sampleSources = new Set(place.sources.filter((s) => s.isSample).map((s) => s.name));
  const address = [[place.address?.street, place.address?.houseNumber].filter(Boolean).join(" "), place.address?.city]
    .filter(Boolean)
    .join(", ");
  const [lon, lat] = place.location.coordinates;
  const coordinates = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

  const wanted = new Set(reportableAttributes(place));
  const factLines = factViews(place, locale, now)
    .filter((f) => wanted.has(f.attribute))
    .flatMap((f) => [
      t.fact(f.label, f.conflict ? t.conflict(f.value ?? "") : [f.value, f.unit].filter(Boolean).join(" ")),
      ...f.sources.map((s) =>
        t.source(s.name, s.date, s.detail, s.value, sampleSources.has(s.name) ? t.sample : undefined),
      ),
    ]);
  const outageLines = (place.outages ?? [])
    .filter(isActiveOutage)
    .map((o: Outage) => t.outage(o.equipment, formatDate(o.reportedAt, locale), o.confirmations));

  const lines = [
    t.greeting,
    "",
    t.intro,
    "",
    t.place(place.name),
    ...(address ? [t.address(address)] : []),
    t.coordinates(coordinates),
    t.link(url),
    "",
    t.barriers,
    ...outageLines,
    ...factLines,
    "",
    t.dataNote(formatDate(now.toISOString(), locale)),
    t.farewell,
  ];
  return { subject: t.subject(place.name, address), body: lines.join("\n") };
}

/** The report as one text to copy: subject first, then the body. */
export function cityReportText(report: CityReport): string {
  return `${report.subject}\n\n${report.body}`;
}

/** Whether `value` is a plain e-mail address; anything else (empty, a URL, several addresses, `?cc=` tricks) is not used. */
export function isReportAddress(value: string | undefined): value is string {
  return !!value && ADDRESS.test(value);
}

/**
 * `mailto:` link for the report, or null without a valid address. Newlines are CRLF (RFC 6068). Lines are dropped from
 * the end until the link fits `maxLength`; the place link sits near the top, so it survives.
 */
export function cityReportMailto(address: string | undefined, report: CityReport, maxLength = MAILTO_MAX_LENGTH): string | null {
  if (!isReportAddress(address)) return null;
  const build = (body: string) =>
    `mailto:${address}?subject=${encodeURIComponent(report.subject)}&body=${encodeURIComponent(body.replaceAll("\n", "\r\n"))}`;
  const lines = report.body.split("\n");
  let url = build(lines.join("\n"));
  while (url.length > maxLength && lines.length > 1) {
    lines.pop();
    url = build(lines.join("\n"));
  }
  return url.length <= maxLength ? url : null;
}
