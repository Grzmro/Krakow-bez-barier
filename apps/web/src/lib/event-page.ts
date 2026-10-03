import type { AccessibilityAttribute, Place } from "@krakow-bez-barier/contracts";
import { intlLocale, type Locale } from "@/i18n/locale";
import { factViews, type FactView } from "@/lib/place-facts";

/** "sobota, 10 października 2026" — the date is a calendar day, so it's formatted without a time zone shift. */
export function formatEventDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export type EventSectionId = "entrance" | "toilet" | "parking";

/** What a visitor needs to get in: the entrance first, then the toilet and parking. */
export const EVENT_SECTIONS: { id: EventSectionId; attributes: readonly AccessibilityAttribute[] }[] = [
  {
    id: "entrance",
    attributes: ["step_count", "step_height_cm", "threshold_cm", "ramp", "door_width_cm", "lift", "surface"],
  },
  { id: "toilet", attributes: ["toilet_accessible", "changing_table"] },
  { id: "parking", attributes: ["disabled_parking"] },
];

/** The place card's fact rows grouped for the event page; missing data stays a "Brak danych" row. */
export function eventSections(place: Place, locale: Locale): { id: EventSectionId; facts: FactView[] }[] {
  const facts = factViews(place, locale);
  return EVENT_SECTIONS.map(({ id, attributes }) => ({
    id,
    facts: attributes.flatMap((attribute) => facts.filter((f) => f.attribute === attribute)),
  }));
}
