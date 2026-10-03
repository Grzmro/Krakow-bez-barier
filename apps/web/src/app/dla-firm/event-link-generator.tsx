"use client";

import { useDeferredValue, useId, useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { buttonVariants, cn } from "@krakow-bez-barier/ui";
import { pl } from "@/i18n/pl";
import { EVENT_NAME_MAX } from "@/lib/event-link";
import { usePlaces } from "@/lib/places";
import { routes } from "@/lib/routes";
import { useOrigin } from "@/lib/use-origin";
import { CodeBlock } from "./code-block";

const t = pl.business.event;

const PLACES_SHOWN = 50;

const fieldClass =
  "h-12 w-full rounded-2xl border border-input bg-card px-4 text-body outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Organizer picks a venue, names the event and gets a shareable link to its event page. */
export function EventLinkGenerator() {
  const ids = { search: useId(), searchHint: useId(), place: useId(), name: useId(), date: useId() };
  const origin = useOrigin();
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<string>();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const q = useDeferredValue(search.trim());
  const places = usePlaces({ ...(q ? { q } : {}), limit: PLACES_SHOWN });
  const items = places.data?.items ?? [];
  // A choice that the current search filtered out falls back to the first result.
  const placeId = items.some((p) => p.id === chosen) ? chosen : items[0]?.id;
  const path = placeId ? routes.event(placeId, { name, date }) : undefined;

  return (
    <>
      <p className="text-body-sm text-foreground/85">{t.lead}</p>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor={ids.search} className="mb-2 block text-body-sm font-semibold">
            {t.search}
          </label>
          <input
            id={ids.search}
            type="search"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-describedby={ids.searchHint}
            className={fieldClass}
          />
          <p id={ids.searchHint} className="mt-1.5 text-caption text-muted-foreground">
            {t.searchHint}
          </p>
        </div>

        <div>
          <label htmlFor={ids.place} className="mb-2 block text-body-sm font-semibold">
            {t.place}
          </label>
          {places.isPending ? (
            <p role="status" className="text-body-sm text-muted-foreground">
              {t.placesLoading}
            </p>
          ) : places.isError ? (
            <p role="alert" className="text-body-sm">
              {t.placesError}
            </p>
          ) : items.length === 0 ? (
            <p role="status" className="text-body-sm text-muted-foreground">
              {t.noPlaces}
            </p>
          ) : (
            <select
              id={ids.place}
              value={placeId}
              onChange={(e) => setChosen(e.target.value)}
              className={fieldClass}
            >
              {items.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.isSample ? t.sampleOption(place.name) : place.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label htmlFor={ids.name} className="mb-2 block text-body-sm font-semibold">
            {t.name}
          </label>
          <input
            id={ids.name}
            type="text"
            autoComplete="off"
            maxLength={EVENT_NAME_MAX}
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor={ids.date} className="mb-2 block text-body-sm font-semibold">
            {t.date}
          </label>
          <input
            id={ids.date}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      {path ? (
        <>
          <CodeBlock code={`${origin}${path}`} label={t.linkLabel} copyLabel={t.copyLink} wrap />
          <a
            href={path}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "mt-3")}
          >
            {t.preview}
            <ArrowSquareOut aria-hidden />
            <span className="sr-only">{t.newTab}</span>
          </a>
        </>
      ) : null}
    </>
  );
}
