"use client";

import { useDeferredValue, useState, type ReactNode } from "react";
import { ArrowSquareOut, MagnifyingGlass } from "@phosphor-icons/react";
import { buttonVariants, cn, Field, Input, Select } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import { EVENT_NAME_MAX } from "@/lib/event-link";
import { config } from "@/lib/config";
import { usePlaces } from "@/lib/places";
import { routes } from "@/lib/routes";
import { bestDocumented } from "@/lib/showcase-place";
import { useOrigin } from "@/lib/use-origin";
import { CodeBlock } from "./code-block";

const PLACES_SHOWN = 50;

/** The venue's label over a loading, error or empty line, where there is no control yet to label. */
function PlaceStatus({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-body-sm font-semibold">{label}</p>
      {children}
    </div>
  );
}

/** Organizer picks a venue, names the event and gets a shareable link to its event page. */
export function EventLinkGenerator() {
  const t = useMessages().business.event;
  const origin = useOrigin();
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<string>();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const q = useDeferredValue(search.trim());
  // Without a search the venues near the Rynek are offered, and the best-documented one is preselected.
  const places = usePlaces(q ? { q, limit: PLACES_SHOWN } : { near: config.cityCenter, limit: PLACES_SHOWN });
  const items = places.data?.items ?? [];
  // A choice that the current search filtered out falls back to the default.
  const placeId = items.some((p) => p.id === chosen) ? chosen : (q ? items[0] : bestDocumented(items))?.id;
  const path = placeId ? routes.event(placeId, { name, date }) : undefined;

  return (
    <>
      <p className="text-body-sm text-foreground/85">{t.lead}</p>

      <div className="mt-4 space-y-4">
        <Field label={t.search} hint={t.searchHint}>
          <Input
            type="search"
            autoComplete="off"
            startIcon={<MagnifyingGlass />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            clearLabel={t.clearSearch}
          />
        </Field>

        {places.isPending ? (
          <PlaceStatus label={t.place}>
            <p role="status" className="text-body-sm text-muted-foreground">
              {t.placesLoading}
            </p>
          </PlaceStatus>
        ) : places.isError ? (
          <PlaceStatus label={t.place}>
            <p role="alert" className="text-body-sm">
              {t.placesError}
            </p>
          </PlaceStatus>
        ) : items.length === 0 ? (
          <PlaceStatus label={t.place}>
            <p role="status" className="text-body-sm text-muted-foreground">
              {t.noPlaces}
            </p>
          </PlaceStatus>
        ) : (
          <Field label={t.place}>
            <Select
              items={items.map((place) => ({ value: place.id, label: place.isSample ? t.sampleOption(place.name) : place.name }))}
              value={placeId ?? null}
              onValueChange={setChosen}
            />
          </Field>
        )}

        <Field label={t.name}>
          <Input
            type="text"
            autoComplete="off"
            maxLength={EVENT_NAME_MAX}
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label={t.date}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
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
