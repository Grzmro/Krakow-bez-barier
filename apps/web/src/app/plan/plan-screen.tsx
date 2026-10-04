"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Trash } from "@phosphor-icons/react";
import type { Place } from "@krakow-bez-barier/contracts";
import { Button, buttonVariants, useAnnounce } from "@krakow-bez-barier/ui";
import { SampleTag, StatusBadge } from "@/components/kbb";
import { ProfileSwitch } from "@/components/profile/profile-switch";
import { useLocale, useMessages } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import {
  segmentPairs,
  segmentStatus,
  stopStatus,
  summarizePlan,
  type PlanSegment,
  type PlanStop,
  type SegmentResult,
} from "@/lib/day-plan";
import { usePlacesById } from "@/lib/places";
import { profileQuery } from "@/lib/profile/thresholds";
import { useProfile } from "@/lib/profile/use-profile";
import { barrierList, gaps } from "@/lib/route-summary";
import { routes } from "@/lib/routes";
import { RouteError, routeQuery, routeRequest } from "@/lib/use-route";
import { usePlan } from "@/lib/use-plan";

type PlanMessages = Messages["plan"];

const coordinates = (place: Place | null | undefined) => place?.location.coordinates as [number, number] | undefined;

const failureText = (t: PlanMessages, reason: "no_route" | "not_configured" | "unavailable") =>
  reason === "no_route" ? t.legNoRoute : reason === "not_configured" ? t.notConfigured : t.legUnavailable;

/** One `POST /routes` per leg (profile limits included), computed from the stops' positions in the plan's order. */
function useSegments(plan: PlanStop[], places: (Place | null | undefined)[]): PlanSegment[] {
  const locale = useLocale();
  const { settings } = useProfile();
  const pairs = segmentPairs(plan);
  const results = useQueries({
    queries: pairs.map((_, i) => {
      const from = coordinates(places[i]);
      const to = coordinates(places[i + 1]);
      if (!from || !to) {
        return { queryKey: ["plan-leg-pending", i], queryFn: () => Promise.reject(new RouteError("no_route")), enabled: false };
      }
      return routeQuery(locale, routeRequest(from, to, "avoid_stairs", settings));
    }),
  });
  return pairs.map((pair, i): PlanSegment => {
    const missing = places[i] === null || places[i + 1] === null;
    const query = results[i];
    let result: SegmentResult = { state: "loading" };
    if (missing) result = { state: "error", reason: "no_route" };
    else if (query.data) result = { state: "route", route: query.data };
    else if (query.error) {
      result = { state: "error", reason: query.error instanceof RouteError ? query.error.reason : "unavailable" };
    }
    return { ...pair, result };
  });
}

export function PlanScreen() {
  const t = useMessages().plan;
  const common = useMessages();
  const announce = useAnnounce();
  const { settings, setProfile } = useProfile();
  const { plan, remove, move, clear } = usePlan();
  const placeQueries = usePlacesById(
    plan.map((s) => s.id),
    profileQuery(settings),
  );
  const places = placeQueries.map((q) => (q.isPending ? undefined : q.data));
  const segments = useSegments(plan, places);
  const summary = summarizePlan(segments);

  const settled = summary.complete;
  const signature = segments.map((s) => (s.result.state === "route" ? s.result.route.durationMinutes : s.result.state)).join("|");
  useEffect(() => {
    if (settled) announce(t.summary.total(Math.round(summary.minutes), common.route.distance(summary.meters)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announces once per settled order of legs
  }, [settled, signature]);

  const act = (run: () => void, message: string) => {
    run();
    announce(message);
  };

  if (plan.length === 0) {
    return (
      <>
        <p className="text-body text-muted-foreground">{t.lead}</p>
        <div className="mt-4 grid justify-items-start gap-3">
          <p className="text-body font-semibold">{t.empty}</p>
          <Link href={routes.home} className={buttonVariants()}>
            {t.findPlaces}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-body text-muted-foreground">{t.lead}</p>
      <ProfileSwitch value={settings.profile} onChange={setProfile} className="mt-3" />

      <section aria-labelledby="plan-stops" className="mt-6">
        <h2 id="plan-stops" className="mb-2 text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {t.stopsHeading}
        </h2>
        <ol className="space-y-2">
          {plan.map((stop, index) => {
            const place = places[index];
            const verdict = place?.verdict ?? null;
            const status = stopStatus(verdict);
            return (
              <li key={stop.id} className="rounded-card border border-border bg-card p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-h3 font-bold">
                      <Link href={routes.place(stop.id)} className="underline-offset-2 hover:underline">
                        {t.stopLabel(index + 1, place?.name ?? stop.name)}
                      </Link>
                    </p>
                    {place === undefined ? (
                      <p className="mt-1 text-body-sm text-muted-foreground">{t.loadingPlace}</p>
                    ) : place === null ? (
                      <p className="mt-1 text-body-sm text-muted-foreground">{t.placeMissing}</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={status} size="sm" unconfirmed={verdict?.unconfirmed} />
                        <span className="text-body-sm text-muted-foreground">
                          {verdict ? (verdict.reasons[0] ?? t.verdict.profile) : t.verdict.noProfile}
                        </span>
                        {place.isSample ? <SampleTag /> : null}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t.moveUp(stop.name)}
                      aria-disabled={index === 0}
                      onClick={() => index > 0 && act(() => move(index, -1), t.moved(stop.name, index, plan.length))}
                    >
                      <ArrowUp weight="bold" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t.moveDown(stop.name)}
                      aria-disabled={index === plan.length - 1}
                      onClick={() =>
                        index < plan.length - 1 && act(() => move(index, 1), t.moved(stop.name, index + 2, plan.length))
                      }
                    >
                      <ArrowDown weight="bold" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t.remove(stop.name)}
                      onClick={() => act(() => remove(stop.id), t.removed(stop.name))}
                    >
                      <Trash weight="bold" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {plan.length < 2 ? (
        <p className="mt-6 text-body text-muted-foreground">{t.needSecond}</p>
      ) : (
        <>
          <section aria-labelledby="plan-legs" className="mt-6">
            <h2 id="plan-legs" className="mb-2 text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              {t.legsHeading}
            </h2>
            <ol className="space-y-2">
              {segments.map(({ from, to, result }) => (
                <li key={`${from.id}>${to.id}`} className="rounded-card border border-border bg-card p-3">
                  <Leg t={t} messages={common} from={from.name} to={to.name} result={result} />
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="plan-summary" className="mt-6">
            <h2 id="plan-summary" className="mb-2 text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              {t.summary.heading}
            </h2>
            <div className="rounded-card border border-border bg-card p-3 text-body">
              <p className="font-semibold">
                {summary.statuses.met + summary.statuses.barrier + summary.statuses.conflict + summary.statuses.unknown === 0
                  ? t.summary.none
                  : summary.complete
                    ? t.summary.total(Math.round(summary.minutes), common.route.distance(summary.meters))
                    : t.summary.partial(Math.round(summary.minutes), common.route.distance(summary.meters))}
              </p>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {t.summary.counts(summary.statuses.barrier, summary.statuses.conflict, summary.statuses.unknown, summary.statuses.met)}
              </p>
              {summary.loading ? <p className="mt-1 text-body-sm text-muted-foreground">{t.summary.loading(summary.loading)}</p> : null}
              {summary.failed ? <p className="mt-1 text-body-sm text-muted-foreground">{t.summary.failed(summary.failed)}</p> : null}
              {summary.statuses.unknown || summary.statuses.conflict ? (
                <p className="mt-1 text-body-sm text-muted-foreground">{t.unknownNote}</p>
              ) : null}
            </div>
          </section>
        </>
      )}

      <Button variant="outline" className="mt-6" onClick={() => act(clear, t.cleared)}>
        <Trash weight="bold" />
        {t.clear}
      </Button>
    </>
  );
}

function Leg({
  t,
  messages,
  from,
  to,
  result,
}: {
  t: PlanMessages;
  messages: Messages;
  from: string;
  to: string;
  result: SegmentResult;
}) {
  const r = messages.route;
  const status = segmentStatus(result);
  return (
    <>
      <p className="font-semibold">{t.leg(from, to)}</p>
      {result.state === "loading" ? <p className="mt-1 text-body-sm text-muted-foreground">{t.legLoading}</p> : null}
      {result.state === "error" ? <p className="mt-1 text-body-sm">{failureText(t, result.reason)}</p> : null}
      {result.state === "route" && status ? (
        <div className="mt-2 grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} size="sm" />
            <span className="text-body-sm font-semibold tabular-nums">
              {r.minutes(Math.round(result.route.durationMinutes))} · {r.distance(result.route.distanceMeters)}
            </span>
          </div>
          <p className="text-body-sm text-muted-foreground">
            {result.route.knownBarrierCount ? t.legBarriers(barrierList(result.route)) : t.legNoKnown}
            {gaps(r, result.route) ? `. ${gaps(r, result.route)}` : ""}
          </p>
          {result.route.fallback ? <p className="text-body-sm">{t.legFallback}</p> : null}
        </div>
      ) : null}
    </>
  );
}
