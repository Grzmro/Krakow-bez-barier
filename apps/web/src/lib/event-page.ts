import type { AccessibilityAttribute, Place } from "@krakow-bez-barier/contracts";
import { factViews, type FactView } from "@/lib/place-facts";

const eventDateFormat = new Intl.DateTimeFormat("pl-PL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "sobota, 10 października 2026" — the date is a calendar day, so it's formatted without a time zone shift. */
export function formatEventDate(date: string): string {
  return eventDateFormat.format(new Date(`${date}T00:00:00Z`));
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
export function eventSections(place: Place): { id: EventSectionId; facts: FactView[] }[] {
  const facts = factViews(place);
  return EVENT_SECTIONS.map(({ id, attributes }) => ({
    id,
    facts: attributes.flatMap((attribute) => facts.filter((f) => f.attribute === attribute)),
  }));
}
