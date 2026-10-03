"use client";

import { Bus, CloudSlash, Info, Tram } from "@phosphor-icons/react";
import type { TransitDeparture, TransitDepartures, TransitStop } from "@krakow-bez-barier/contracts";
import { Button } from "@krakow-bez-barier/ui";
import { VehicleBadge } from "@/components/kbb";
import { useLocale, useMessages } from "@/i18n/client";
import { DEPARTURES_RADIUS_M, departuresNotice, formatClock, formatDateTime } from "@/lib/transit";
import { useDepartures } from "@/lib/use-departures";

/** Nearest stops with their next departures and whether each vehicle takes a wheelchair (ZTP live data). */
export function TransitSection({ location }: { location: [number, number] }) {
  const t = useMessages().transit;
  const query = useDepartures(location);

  return (
    <section aria-labelledby="place-transit" className="mt-8">
      <h2 id="place-transit" className="text-title font-semibold">
        {t.title}
      </h2>
      <p className="mt-1 text-caption text-muted-foreground">{t.lead(DEPARTURES_RADIUS_M)}</p>
      {query.isPending ? (
        <p role="status" className="mt-3 text-body-sm text-muted-foreground">
          {t.loading}
        </p>
      ) : query.isError ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-muted p-4">
          <p className="text-body-sm">{t.loadError}</p>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            {t.retry}
          </Button>
        </div>
      ) : (
        <Departures data={query.data} />
      )}
    </section>
  );
}

function Departures({ data }: { data: TransitDepartures }) {
  const t = useMessages().transit;
  const locale = useLocale();
  const notice = departuresNotice(data);
  const fetchedAt = data.fetchedAt ? formatDateTime(data.fetchedAt, locale) : null;
  const hasStops = data.stops.length > 0;

  return (
    <>
      {notice === "outage" || notice === "outageNoData" || notice === "stale" || notice === "partial" ? (
        <div className="mt-3 flex gap-3 rounded-2xl bg-status-conflict-bg p-4">
          <CloudSlash weight="bold" className="mt-0.5 size-6 shrink-0 text-status-conflict" aria-hidden />
          <p className="text-body-sm font-semibold text-status-conflict">
            {notice === "partial"
              ? data.source.statusNote
              : notice === "stale" && fetchedAt
                ? t.stale(fetchedAt)
                : notice === "outage" && fetchedAt
                  ? t.outage(fetchedAt)
                  : t.outageNoData}
          </p>
        </div>
      ) : notice ? (
        <p className="mt-3 flex gap-2 rounded-2xl border border-dashed border-status-unknown bg-status-unknown-bg p-3 text-body-sm">
          <Info weight="bold" className="mt-0.5 size-[18px] shrink-0" aria-hidden />
          {notice === "recorded" && fetchedAt ? t.recorded(fetchedAt) : t.disabled}
        </p>
      ) : null}

      {data.mode !== "disabled" && notice !== "outageNoData" ? (
        hasStops ? (
          <ul className="mt-3 space-y-3">
            {data.stops.map((stop) => (
              <StopCard key={stop.id} stop={stop} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-body-sm text-muted-foreground">{t.noStops(DEPARTURES_RADIUS_M)}</p>
        )
      ) : null}

      {hasStops ? <p className="mt-3 text-caption text-muted-foreground">{t.unverifiedHint}</p> : null}
      <p className="mt-2 text-caption text-muted-foreground">
        {[t.source(data.source.name), fetchedAt ? t.fetchedAt(fetchedAt) : null, t.license(data.source.license)]
          .filter(Boolean)
          .join(" · ")}
        {data.source.attribution ? ` · ${data.source.attribution}` : null}
      </p>
    </>
  );
}

function StopCard({ stop }: { stop: TransitStop }) {
  const t = useMessages().transit;
  const headingId = `stop-${stop.id.replace(/[^A-Za-z0-9_-]/g, "-")}`;
  return (
    <li aria-labelledby={headingId} className="rounded-[20px] bg-surface-raised p-4 shadow-soft ring-1 ring-border">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 id={headingId} className="text-body font-semibold">
          {stop.name}
        </h3>
        <p className="text-caption text-muted-foreground">{t.distance(stop.distanceMeters)}</p>
      </div>
      {stop.departures.length ? (
        <ol className="mt-2 divide-y divide-border">
          {stop.departures.map((departure) => (
            <DepartureRow key={`${departure.tripId}-${departure.departureAt}`} departure={departure} />
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-body-sm text-muted-foreground">{t.noDepartures}</p>
      )}
    </li>
  );
}

function DepartureRow({ departure }: { departure: TransitDeparture }) {
  const t = useMessages().transit;
  const locale = useLocale();
  const ModeIcon = departure.mode === "tram" ? Tram : Bus;
  // A lone operator flag is the badge itself; any other statement, or two of them, is listed with its source.
  const { evidence } = departure.vehicle;
  const showEvidence = evidence.length > 1 || evidence.some((e) => e.kind !== "operator_flag");
  const details = [
    `${t.departs} ${formatClock(departure.departureAt, locale)}`,
    departure.platform ? t.platform(departure.platform) : null,
    departure.delaySeconds !== null ? t.delay(departure.delaySeconds) : null,
    departure.vehicle.label ? t.vehicleNumber(departure.vehicle.label) : null,
  ].filter(Boolean);

  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="inline-flex min-w-[4.5rem] items-center justify-center gap-1 rounded-full bg-muted px-2.5 py-1 text-body-sm font-bold tabular-nums">
        <ModeIcon weight="bold" className="size-4" aria-hidden />
        <span className="sr-only">{t.mode[departure.mode]} </span>
        {departure.line}
      </span>
      <div className="min-w-0 flex-1">
        {departure.headsign ? (
          <p className="text-body-sm font-semibold">
            <span className="sr-only">{t.towards} </span>
            <span aria-hidden>→ </span>
            {departure.headsign}
          </p>
        ) : null}
        <p className="text-caption text-muted-foreground tabular-nums">{details.join(" · ")}</p>
        <VehicleBadge state={departure.vehicle.state} className="mt-1.5" />
        {showEvidence ? (
          <ul aria-label={t.evidenceTitle} className="mt-1 space-y-0.5 text-caption text-muted-foreground">
            {departure.vehicle.evidence.map((e) => (
              <li key={e.kind}>
                {t.evidenceLine(t.evidenceKind[e.kind], t.evidenceValue(e.accessible), t.evidenceReliability[e.reliability], e.detail)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
