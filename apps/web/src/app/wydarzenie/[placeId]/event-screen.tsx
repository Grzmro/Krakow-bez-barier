"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Bus, Car, CalendarBlank, DoorOpen, MapPin, Printer, Toilet, type Icon } from "@phosphor-icons/react";
import type { Place } from "@krakow-bez-barier/contracts";
import { Button, LogoMark, buttonVariants, cn } from "@krakow-bez-barier/ui";
import { ReliabilityBadge, SampleTag } from "@/components/kbb";
import { useLocale, useMessages } from "@/i18n/client";
import type { EventDetails } from "@/lib/event-link";
import { eventSections, formatEventDate, type EventSectionId } from "@/lib/event-page";
import { failedSources, formatDate, latestSourceDate, type FactView } from "@/lib/place-facts";
import { usePlace } from "@/lib/places";
import { routes } from "@/lib/routes";
import { useOrigin } from "@/lib/use-origin";


const SECTION_ICON: Record<EventSectionId, Icon> = { entrance: DoorOpen, toilet: Toilet, parking: Car };

export function EventScreen({ placeId, details }: { placeId: string; details: EventDetails }) {
  const t = useMessages().event;
  const query = usePlace(placeId, {});

  if (query.isPending) {
    return (
      <p role="status" className="py-10 text-body text-muted-foreground">
        {t.loading}
      </p>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="space-y-4 py-10">
        <p className="text-body">{t.loadError}</p>
        <Button variant="outline" onClick={() => query.refetch()}>
          {t.retry}
        </Button>
      </div>
    );
  }
  if (!query.data) {
    return (
      <div className="space-y-3 py-10">
        <h1 className="font-display text-h1 font-bold">{t.notFound}</h1>
        <p className="text-body text-muted-foreground">{t.notFoundHint}</p>
        <Link href={routes.home} className={buttonVariants({ variant: "outline" })}>
          {t.goHome}
        </Link>
      </div>
    );
  }
  return <EventSheet place={query.data} details={details} />;
}

function Card({ id, title, icon: CardIcon, children }: { id: string; title: string; icon: Icon; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="mt-4 rounded-[20px] bg-card p-4 ring-1 ring-border break-inside-avoid print:rounded-none print:bg-transparent print:p-0 print:pt-3 print:ring-0"
    >
      <h2 id={id} className="flex items-center gap-2 font-display text-title font-bold">
        <CardIcon weight="duotone" className="size-5 shrink-0 text-primary" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

function FactItem({ fact }: { fact: FactView }) {
  const m = useMessages();
  const t = m.event;
  const value = fact.unknown ? m.common.fact.noValue : [fact.value, fact.unit].filter(Boolean).join(" ");
  return (
    <li className="py-2.5 break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="text-body-sm">
          <span className="text-muted-foreground">{fact.label}:</span>{" "}
          <span className={cn("font-semibold", fact.unknown && "text-muted-foreground")}>{value}</span>
        </p>
        <ReliabilityBadge value={fact.reliability} />
      </div>
      {fact.sources.length ? (
        <ul className="mt-0.5 space-y-0.5">
          {fact.sources.map((source, i) => (
            <li key={`${source.name}-${i}`} className="text-caption text-muted-foreground">
              {t.sourceLine(source.name, source.date, source.value)}
              {source.staleNote ? <span className="font-semibold text-foreground"> · {source.staleNote}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-0.5 text-caption text-muted-foreground">{t.noSource}</p>
      )}
    </li>
  );
}

function EventSheet({ place, details }: { place: Place; details: EventDetails }) {
  const m = useMessages();
  const t = m.event;
  const locale = useLocale();
  const origin = useOrigin();
  const sections = eventSections(place, locale);
  const latest = latestSourceDate(place);
  const failed = new Set(failedSources(place).map((s) => s.id));
  const address = [[place.address?.street, place.address?.houseNumber].filter(Boolean).join(" "), place.address?.city]
    .filter(Boolean)
    .join(", ");
  const fullCard = routes.place(place.id);

  return (
    <article aria-labelledby="event-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t.kicker}</p>
          <h1 id="event-title" className="mt-1 font-display text-h1 font-bold">
            {details.name ?? place.name}
          </h1>
          {details.name || details.date ? (
            <p className="mt-1 text-caption text-muted-foreground">{t.organizerProvided}</p>
          ) : null}
        </div>
        {place.isSample ? <SampleTag className="mt-1 shrink-0" /> : null}
      </div>

      <dl className="mt-3 space-y-1.5 text-body-sm">
        <div>
          <dt className="sr-only">{t.venue}</dt>
          <dd className="flex gap-2">
            <MapPin weight="fill" className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden />
            <span>
              <span className="font-semibold">{place.name}</span>
              {address ? <span className="text-muted-foreground">{` · ${address}`}</span> : null}
            </span>
          </dd>
        </div>
        {details.date ? (
          <div>
            <dt className="sr-only">{t.date}</dt>
            <dd className="flex gap-2">
              <CalendarBlank weight="fill" className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden />
              <span className="font-semibold first-letter:uppercase">{formatEventDate(details.date, locale)}</span>
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-3 text-body-sm text-foreground/85">{t.lead}</p>
      {place.isSample ? <p className="mt-2 text-caption font-semibold">{t.sampleNote}</p> : null}

      {sections.map((section) => (
        <Card key={section.id} id={`event-${section.id}`} title={t.sections[section.id]} icon={SECTION_ICON[section.id]}>
          {section.id === "entrance" && place.entranceHint ? (
            <p className="mt-2 text-body-sm">
              <span className="text-muted-foreground">{t.entranceHint}:</span> {place.entranceHint}
            </p>
          ) : null}
          <FactList facts={section.facts} label={t.sections[section.id]} />
        </Card>
      ))}

      {/* TODO(KBB-60): list the nearest ZTP stops with their accessibility facts once the ZTP licence is confirmed. */}
      <Card id="event-transit" title={t.transit.title} icon={Bus}>
        <p className="mt-2 text-body-sm text-muted-foreground">{t.transit.noData}</p>
      </Card>

      <section aria-labelledby="event-sources" className="mt-6 break-inside-avoid">
        <h2 id="event-sources" className="text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {t.sourcesTitle}
        </h2>
        {place.sources.length ? (
          <ul className="mt-2 space-y-1.5">
            {place.sources.map((source) => (
              <li key={source.id} className="text-body-sm">
                <span className="font-semibold">{source.name}</span>
                {source.isSample ? <SampleTag className="ml-2 align-middle" /> : null}
                <span className="text-muted-foreground">
                  {` · ${t.lastSuccess(source.lastSuccessAt ? formatDate(source.lastSuccessAt, locale) : undefined)}`}
                  {source.attribution ? ` · ${source.attribution}` : null}
                </span>
                {failed.has(source.id) ? (
                  <span className="font-semibold text-status-conflict">{` · ${source.statusNote ?? t.sourceOutage}`}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-body-sm text-muted-foreground">{t.sourcesNone}</p>
        )}
        {latest ? <p className="mt-2 text-caption text-muted-foreground">{t.updated(formatDate(latest, locale))}</p> : null}
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-2 print:hidden">
        <Link href={fullCard} className={buttonVariants({ variant: "default" })}>
          {t.fullCard}
          <ArrowRight weight="bold" aria-hidden />
        </Link>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer weight="bold" aria-hidden />
          {t.print}
        </Button>
      </div>

      <footer className="mt-6 hidden border-t border-border pt-3 text-caption print:block">
        <p className="break-all">{t.fullCardPrint(`${origin}${fullCard}`)}</p>
        <p className="mt-1 flex items-center gap-1.5 font-semibold">
          <LogoMark className="size-4" />
          {m.common.app.name}
        </p>
      </footer>
    </article>
  );
}

function FactList({ facts, label }: { facts: FactView[]; label: string }) {
  return (
    <ul aria-label={label} className="mt-1 divide-y divide-border">
      {facts.map((fact) => (
        <FactItem key={fact.attribute} fact={fact} />
      ))}
    </ul>
  );
}
