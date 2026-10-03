import type { AccessibilityAttribute, components } from "@krakow-bez-barier/contracts";
import type { Reliability } from "@krakow-bez-barier/ui";
import { pl } from "@/i18n/pl";
import { RELIABILITY, formatDate, formatValue } from "@/lib/place-facts";

type WidgetFact = components["schemas"]["WidgetFact"];

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
  const label = pl.place.attribute[fact.attribute];
  if (fact.state === "unknown" || !fact.value) {
    return { attribute: fact.attribute, label, value: pl.common.fact.noValue, reliability: "unknown", unknown: true };
  }
  const formatted = formatValue(fact.attribute, fact.value);
  return {
    attribute: fact.attribute,
    label,
    value: formatted.unit ? `${formatted.value} ${formatted.unit}` : formatted.value,
    reliability: RELIABILITY[fact.status],
    source: fact.sourceName
      ? pl.business.widget.sourceLine(fact.sourceName, fact.fetchedAt ? formatDate(fact.fetchedAt) : undefined)
      : undefined,
    unknown: false,
  };
}
