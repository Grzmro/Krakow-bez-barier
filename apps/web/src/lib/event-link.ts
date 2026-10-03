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
