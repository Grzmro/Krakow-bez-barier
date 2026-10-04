import type { AccessibilityAttribute, FactValue } from "@krakow-bez-barier/contracts";
import { intlLocale, type Locale } from "./locale";
import type { Messages } from "./messages";

type PlaceCatalog = Pick<Messages["place"], "value" | "unit" | "overall" | "surface">;

const numberFormats = new Map<Locale, Intl.NumberFormat>();

function formatNumber(n: number, locale: Locale): string {
  let format = numberFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits: 2, useGrouping: false });
    numberFormats.set(locale, format);
  }
  return format.format(n);
}

/**
 * One typed value in the place card's words, the unit split off so the UI can style it. Shared by the card
 * (`formatValue`) and the list chips (`summary.chip`), which take the catalog to avoid an import cycle.
 */
export function factValueText(
  attribute: AccessibilityAttribute,
  value: FactValue,
  t: PlaceCatalog,
  locale: Locale,
): { value: string; unit?: string } {
  switch (value.kind) {
    case "boolean":
      return { value: value.boolean ? t.value.yes : t.value.no };
    case "number":
      if (attribute === "step_count") {
        return { value: value.number === 0 ? t.value.noSteps : t.value.steps(value.number) };
      }
      return { value: formatNumber(value.number, locale), unit: value.unit ? t.unit[value.unit] || undefined : undefined };
    case "text":
      if (attribute === "wheelchair_overall") return { value: t.overall[value.text] ?? value.text };
      return { value: t.surface[value.text] ?? value.text };
  }
}

export function joinValue(v: { value: string; unit?: string }) {
  return v.unit ? `${v.value} ${v.unit}` : v.value;
}
