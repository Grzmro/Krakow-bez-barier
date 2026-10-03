import type { AccessibilityAttribute, components } from "@krakow-bez-barier/contracts";
import type { Reliability } from "@krakow-bez-barier/ui";
import { pl } from "@/i18n/pl";
import { RELIABILITY, formatDate, formatValue, joinValue } from "@/lib/place-facts";

type WidgetFact = components["schemas"]["WidgetFact"];

const t = pl.business.widget;

export interface WidgetFactView {
  attribute: AccessibilityAttribute;
  label: string;
  /** Value with its unit, or "Brak danych" — never empty, never implied. */
  value: string;
  reliability: Reliability;
  /** "Dane obiektu · 12.09.2026"; undefined when no source has checked it. */
  source?: string;
  unknown: boolean;
}

/** One widget row per fact the API returned; a missing value is named as missing, never as accessible. */
export function widgetFactView(fact: WidgetFact): WidgetFactView {
  const label = pl.common.attribute[fact.attribute];
  // The card carries one value per fact, so a conflict can't show both sides here; the full card does.
  if (fact.state === "conflict") {
    return { attribute: fact.attribute, label, value: t.conflict, reliability: "conflict", source: t.conflictHint, unknown: false };
  }
  if (fact.state === "unknown" || !fact.value) {
    return { attribute: fact.attribute, label, value: pl.common.fact.noValue, reliability: "unknown", unknown: true };
  }
  return {
    attribute: fact.attribute,
    label,
    value: joinValue(formatValue(fact.attribute, fact.value)),
    reliability: RELIABILITY[fact.status],
    source: fact.sourceName
      ? t.sourceLine(fact.sourceName, fact.fetchedAt ? formatDate(fact.fetchedAt) : undefined)
      : undefined,
    unknown: false,
  };
}
