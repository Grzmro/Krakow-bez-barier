import type {
  ModerationEvent,
  ModerationReport,
  ReportStatus,
} from "@krakow-bez-barier/contracts";
import { intlLocale, type Locale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";
import { formatDate, formatValue, joinValue } from "./place-facts";

/** Statuses still waiting for a moderator; `accepted` and `rejected` are final. */
export const OPEN_STATUSES: readonly ReportStatus[] = ["new", "needs_info"];

export const isOpen = (report: Pick<ModerationReport, "status">) => OPEN_STATUSES.includes(report.status);

/** "What changes on the card": the value shown now and the one an accepted report puts there. */
export type ChangePreview = {
  attribute: string;
  before: string;
  /** "<source> · <date>" of the value shown now; null when there is none. */
  beforeSource: string | null;
  after: string;
  beforeKnown: boolean;
};

export function changePreview(report: ModerationReport, locale: Locale): ChangePreview {
  const m = messagesFor(locale);
  const t = m.moderator;
  const current = report.currentValue ?? null;
  const source = report.currentSource ?? null;
  return {
    attribute: m.common.attribute[report.attribute],
    before: current ? joinValue(formatValue(report.attribute, current, locale)) : t.noData,
    beforeSource: current && source ? t.sourceLine(source.name, formatDate(source.asOf, locale)) : null,
    after: joinValue(formatValue(report.attribute, report.value, locale)),
    beforeKnown: current !== null,
  };
}

export type HistoryEntry = ModerationEvent & {
  key: string;
  reportId: string;
  placeId: string;
  placeName: string;
  /** Place, attribute and value — as a change for an approval, as what was reported otherwise. */
  summary: string;
};

/** Every decision across the reports — who, what and when — newest first. */
export function moderationHistory(reports: ModerationReport[], locale: Locale): HistoryEntry[] {
  const m = messagesFor(locale);
  return reports
    .flatMap((report) =>
      report.history.map((event, i) => ({
        ...event,
        key: `${report.id}-${i}`,
        reportId: report.id,
        placeId: report.placeId,
        placeName: report.placeName,
        summary: m.moderator.historySummary[event.decision === "accepted" ? "accepted" : "reported"](
          report.placeName,
          m.common.attribute[report.attribute],
          joinValue(formatValue(report.attribute, report.value, locale)),
        ),
      })),
    )
    .sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt));
}

/** Whole minutes from a `Retry-After` header (seconds); the server's 15-minute lockout when it is missing. */
export function retryMinutes(retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 15;
}

export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale[locale], { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Warsaw" }).format(
    new Date(iso),
  );
}
