import type { AccessibilityAttribute, Place } from "@krakow-bez-barier/contracts";
import { factViews, type FactView } from "@/lib/place-facts";

/** Query parameters of the event page link; Polish, because organizers paste the link into Polish mail. */
export const EVENT_PARAMS = { name: "nazwa", date: "data" } as const;

export const EVENT_NAME_MAX = 120;

export type EventDetails = { name?: string; date?: string };

type SearchParams = Record<string, string | string[] | undefined>;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date `YYYY-MM-DD` that really exists (no 2026-02-30). */
export function isEventDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads the event name and date from the link; anything malformed is dropped, not shown. */
export function readEventDetails(params: SearchParams): EventDetails {
  const name = first(params[EVENT_PARAMS.name])?.trim().slice(0, EVENT_NAME_MAX);
  const date = first(params[EVENT_PARAMS.date])?.trim();
  return {
    ...(name ? { name } : {}),
    ...(date && isEventDate(date) ? { date } : {}),
  };
}

/** Path of the event page for a place, with the event name and date when given. */
export function eventPath(placeId: string, details: EventDetails = {}): string {
  const query = new URLSearchParams();
  const name = details.name?.trim().slice(0, EVENT_NAME_MAX);
  if (name) query.set(EVENT_PARAMS.name, name);
  if (details.date && isEventDate(details.date)) query.set(EVENT_PARAMS.date, details.date);
  const search = query.toString();
  return `/wydarzenie/${encodeURIComponent(placeId)}${search ? `?${search}` : ""}`;
}

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
