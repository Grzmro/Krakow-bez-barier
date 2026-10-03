import type { Category, PriorityItem } from "@krakow-bez-barier/contracts";
import type { Messages } from "@/i18n/messages";

/** A ranked place's reasons as text, each with the points it gave: "bariera: wejście (+4), brak danych o wejściu (+1)". */
export function reasonsText(item: PriorityItem, messages: Messages): string {
  const t = messages.city.priorities;
  const needs = item.barriers.map((need) => messages.profile.needName[need].toLowerCase()).join(", ");
  return item.reasons.map((r) => t.reasonWithPoints(t.reason[r.factor](r.count, needs), r.points)).join(", ");
}

// Spreadsheets run a cell that starts with one of these as a formula; OSM names are free text.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string | number): string {
  const text = typeof value === "number" ? String(value) : FORMULA_START.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * The priority ranking as CSV: semicolon-separated (what Excel expects in Polish locales), UTF-8 with a BOM so the
 * Polish letters survive opening it, CRLF line ends (RFC 4180).
 */
export function priorityCsv(
  items: PriorityItem[],
  messages: Messages,
  categoryLabel: (id: Category) => string,
): string {
  const t = messages.city.priorities;
  const rows = items.map((item) => [
    item.rank,
    item.placeName,
    categoryLabel(item.category),
    item.score,
    t.actionName[item.action],
    reasonsText(item, messages),
    item.openReports,
    item.location.coordinates[0],
    item.location.coordinates[1],
    item.placeId,
  ]);
  return `﻿${[t.csvHeader, ...rows].map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}
