import type {
  ModerationEvent,
  ModerationReport,
  ReportStatus,
} from "@krakow-bez-barier/contracts";
import { pl } from "@/i18n/pl";
import { formatValue, joinValue } from "./place-facts";

const t = pl.moderator;

/** Statuses still waiting for a moderator; `accepted` and `rejected` are final. */
export const OPEN_STATUSES: readonly ReportStatus[] = ["new", "needs_info"];

export const isOpen = (report: Pick<ModerationReport, "status">) => OPEN_STATUSES.includes(report.status);

/** "What changes on the card": the value shown now and the one an accepted report puts there. */
export type ChangePreview = { attribute: string; before: string; after: string; beforeKnown: boolean };

export function changePreview(report: ModerationReport): ChangePreview {
  const current = report.currentValue ?? null;
  return {
    attribute: pl.common.attribute[report.attribute],
    before: current ? joinValue(formatValue(report.attribute, current)) : t.noData,
    after: joinValue(formatValue(report.attribute, report.value)),
    beforeKnown: current !== null,
  };
}

export type HistoryEntry = ModerationEvent & {
  key: string;
  reportId: string;
  placeName: string;
  attribute: string;
  value: string;
};

/** Every decision across the reports — who, what and when — newest first. */
export function moderationHistory(reports: ModerationReport[]): HistoryEntry[] {
  return reports
    .flatMap((report) =>
      report.history.map((event, i) => ({
        ...event,
        key: `${report.id}-${i}`,
        reportId: report.id,
        placeName: report.placeName,
        attribute: pl.common.attribute[report.attribute],
        value: joinValue(formatValue(report.attribute, report.value)),
      })),
    )
    .sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt));
}

/** Whole minutes from a `Retry-After` header (seconds); the server's 15-minute lockout when it is missing. */
export function retryMinutes(retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 15;
}

const dateTime = new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Warsaw" });

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
