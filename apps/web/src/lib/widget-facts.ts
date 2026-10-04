import type { AccessibilityAttribute, components } from "@krakow-bez-barier/contracts";
import type { Reliability } from "@krakow-bez-barier/ui";
import type { Locale } from "@/i18n/locale";
import { messagesFor } from "@/i18n/messages";
import { RELIABILITY, formatDate, formatValue, joinValue } from "@/lib/place-facts";

type WidgetFact = components["schemas"]["WidgetFact"];

export interface WidgetFactView {
  attribute: AccessibilityAttribute;
  label: string;
  /** Value with its unit, or "Brak danych" — never empty, never implied. */
  value: string;
  reliability: Reliability;
  /** "Dane obiektu · 12.09.2026"; undefined when no source has checked it. */
  source?: string;
  /** The source's own name and the formatted date, apart, so the name can carry its language. */
  sourceName?: string;
  sourceDate?: string;
  unknown: boolean;
}

/** One widget row per fact the API returned; a missing value is named as missing, never as accessible. */
export function widgetFactView(fact: WidgetFact, locale: Locale): WidgetFactView {
  const m = messagesFor(locale);
  const t = m.business.widget;
  const label = m.common.attribute[fact.attribute];
  // The card carries one value per fact, so a conflict can't show both sides here; the full card does.
  if (fact.state === "conflict") {
    return { attribute: fact.attribute, label, value: t.conflict, reliability: "conflict", source: t.conflictHint, unknown: false };
  }
  if (fact.state === "unknown" || !fact.value) {
    return { attribute: fact.attribute, label, value: m.common.fact.noValue, reliability: "unknown", unknown: true };
  }
  const date = fact.fetchedAt ? formatDate(fact.fetchedAt, locale) : undefined;
  return {
    attribute: fact.attribute,
    label,
    value: joinValue(formatValue(fact.attribute, fact.value, locale)),
    reliability: RELIABILITY[fact.status],
    source: fact.sourceName ? t.sourceLine(fact.sourceName, date) : undefined,
    ...(fact.sourceName ? { sourceName: fact.sourceName, sourceDate: date } : {}),
    unknown: false,
  };
}
