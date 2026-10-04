"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowSquareOut, DownloadSimple, SignOut } from "@phosphor-icons/react";
import type { CityStats, NeedVerdict } from "@krakow-bez-barier/contracts";
import { Button, cn, useAnnounce } from "@krakow-bez-barier/ui";
import { bearer, DemoSignIn, ModeratorSignIn, StatusError, useModeratorSession } from "@/components/moderator/moderator-session";
import { InfoSection } from "@/components/layout/info-page";
import { useLocale, useMessages } from "@/i18n/client";
import { CITY_EXCLUDED_CATEGORIES } from "@/domain/city-stats";
import { GUS_BDL_SOURCE, gusIndicator, gusSnapshot } from "@/domain/gus-bdl";
import { api } from "@/lib/api";
import { useCategories, useCategoryLookup } from "@/lib/categories";
import { formatCount, priorityCsv, reasonsText } from "@/lib/city";
import { formatDateTime, retryMinutes } from "@/lib/moderation";
import { formatDate } from "@/lib/place-facts";
import { routes } from "@/lib/routes";

// Signing out here or in /moderator drops both pages' data.
const QUERY_KEY = ["moderation"] as const;
const RANKING_SIZE = 25;
// The spec's maximum `limit`: the CSV takes the longest ranking the API gives, and says so when it is cut.
const EXPORT_SIZE = 100;

// Order of the stacked bars and table columns: worst first, "Brak danych" before "Spełnia".
const STATES: NeedVerdict[] = ["barrier", "conflict", "unknown", "met"];
const BAR: Record<NeedVerdict, string> = {
  barrier: "bg-status-barrier",
  conflict: "bg-status-conflict",
  unknown: "stripes-unknown",
  met: "bg-status-met",
};

async function fetchStats(token: string, limit = RANKING_SIZE): Promise<CityStats> {
  const { data, response } = await api.GET("/city/stats", {
    params: { query: { limit } },
    headers: bearer(token),
  });
  if (!data) throw new StatusError(response.status, response.headers.get("retry-after"));
  return data;
}

/** `demoRevertMinutes` (`demoSignInMinutes`): as on /moderator — the same demo account opens this panel. */
export function CityScreen({ demoRevertMinutes }: { demoRevertMinutes: number | null }) {
  const m = useMessages();
  const { token, notice, signIn, signOut } = useModeratorSession(QUERY_KEY);

  return token ? (
    <CityPanel token={token} onSignOut={signOut} />
  ) : (
    <>
      <p className="mt-2 text-body-sm text-foreground/85">{m.city.signInLead}</p>
      <DemoSignIn revertMinutes={demoRevertMinutes} signedInMessage={m.city.signedIn} onSignedIn={signIn} />
      <ModeratorSignIn notice={notice} signedInMessage={m.city.signedIn} onSignedIn={signIn} />
    </>
  );
}

/** A table that may scroll sideways on a phone: focusable and named, so it can be scrolled with the keyboard. */
function TableRegion({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "overflow-x-auto rounded-[20px] bg-surface-raised ring-1 ring-border/70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Context from GUS BDL: a static snapshot with its variable ids, years, licence and fetch date (never fetched per request). */
function GusContext() {
  const t = useMessages().city.gus;
  const locale = useLocale();
  const count = (n: number) => formatCount(n, locale);
  const disabled = gusIndicator("disabled");
  const adapted = gusIndicator("museumsAdapted");
  const museums = gusIndicator("museums");
  const tiles = [
    { label: t.label.disabled, value: count(disabled.value), sub: t.census(disabled.year, disabled.variableId) },
    ...(["postWorkingAge", "population", "museumVisitors"] as const).map((key) => {
      const i = gusIndicator(key);
      return { label: t.label[key], value: count(i.value), sub: t.year(i.year, i.variableId) };
    }),
    {
      label: t.label.museumsAdapted,
      value: t.outOf(count(adapted.value), count(museums.value)),
      sub: t.museumsYear(adapted.year, adapted.variableId, museums.variableId),
    },
  ];

  return (
    <InfoSection title={t.heading}>
      <p className="text-body-sm text-foreground/85">{t.lead}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col rounded-[20px] bg-surface-raised p-4 ring-1 ring-border/70">
            <dt className="text-caption text-muted-foreground">{tile.label}</dt>
            <dd className="mt-1 font-display text-h2 font-bold tabular-nums">{tile.value}</dd>
            <dd className="text-caption text-muted-foreground">{tile.sub}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-body-sm text-foreground/85">{t.museumsNote}</p>
      <p className="mt-1 text-caption text-muted-foreground">
        {t.sourcePrefix}{" "}
        <a
          href={GUS_BDL_SOURCE.url}
          className="inline-flex min-h-6 items-center gap-1 font-semibold text-primary underline underline-offset-2"
        >
          {GUS_BDL_SOURCE.name}
          <ArrowSquareOut weight="bold" className="size-3.5" aria-hidden />
        </a>
        {t.licenseFetched(GUS_BDL_SOURCE.license, formatDate(gusSnapshot.fetchedAt, locale))}
      </p>
    </InfoSection>
  );
}

const tableCell = "border-b border-border px-3 py-2 align-top";
const headCell = "border-b border-border px-3 py-2 text-left font-semibold text-muted-foreground";

function CityPanel({ token, onSignOut }: { token: string; onSignOut: (message: string) => void }) {
  const messages = useMessages();
  const t = messages.city;
  const locale = useLocale();
  const announce = useAnnounce();
  const category = useCategoryLookup();
  const { data: categoryList } = useCategories();
  const ids = { needs: useId(), reports: useId(), priorities: useId() };

  const query = useQuery({ queryKey: [...QUERY_KEY, "city"], queryFn: () => fetchStats(token), retry: false });
  const expired = query.error instanceof StatusError && query.error.status === 401;

  useEffect(() => {
    if (expired) onSignOut(messages.moderator.sessionExpired);
  }, [expired, onSignOut, messages.moderator.sessionExpired]);

  const loadError =
    query.error instanceof StatusError && query.error.status === 429
      ? t.loadLockedOut(retryMinutes(query.error.retryAfter))
      : t.loadFailed;
  useEffect(() => {
    if (query.isError && !expired) announce(loadError);
  }, [announce, query.isError, expired, loadError]);

  const announcedLoad = useRef(false);
  useEffect(() => {
    if (!query.isSuccess || announcedLoad.current) return;
    announcedLoad.current = true;
    announce(t.loaded(query.data.places.total));
  }, [announce, query.isSuccess, query.data, t]);

  if (query.isPending) {
    return (
      <p className="mt-4 text-body-sm text-muted-foreground" aria-busy="true">
        {t.loading}
      </p>
    );
  }

  if (query.isError) {
    return (
      <div className="mt-4 rounded-[20px] bg-status-barrier-bg p-4 text-body-sm text-status-barrier">
        <p>{loadError}</p>
        <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
          {messages.moderator.retry}
        </Button>
      </div>
    );
  }

  const stats = query.data;
  const openReports = stats.reports.filter((r) => r.status === "new" || r.status === "needs_info").reduce((s, r) => s + r.count, 0);
  const total = stats.places.total;
  const needName = (need: keyof typeof messages.profile.needName) => messages.profile.needName[need];
  const busy = stats.criteria
    .flatMap((c) => c.categories)
    .map((id) => category(id).label.toLowerCase())
    .join(", ");

  const excluded = CITY_EXCLUDED_CATEGORIES.map((id) => categoryList?.find((c) => c.id === id)?.label ?? category(id).label)
    .map((label) => label.toLowerCase())
    .join(", ");

  const downloadCsv = async () => {
    let ranking = stats;
    if (stats.priorities.items.length < stats.priorities.total) {
      try {
        ranking = await fetchStats(token, EXPORT_SIZE);
      } catch {
        announce(t.priorities.exportFailed);
        return;
      }
    }
    const { items, total: rankedTotal } = ranking.priorities;
    const csv = priorityCsv(items, messages, (id) => category(id).label);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = t.priorities.csvFile(ranking.generatedAt.slice(0, 10), items.length);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    announce(t.priorities.exported(items.length, rankedTotal));
  };

  const tiles = [
    { label: t.tiles.places, value: total, sub: null },
    { label: t.tiles.withData, value: stats.places.withData, sub: t.tiles.share(stats.places.withData, total) },
    { label: t.tiles.withoutData, value: stats.places.withoutData, sub: t.tiles.share(stats.places.withoutData, total) },
    { label: t.tiles.openReports, value: openReports, sub: null },
    { label: t.tiles.stale, value: stats.staleData.places, sub: t.tiles.staleFacts(stats.staleData.facts) },
    { label: t.tiles.conflicts, value: stats.conflicts.places, sub: t.tiles.conflictAttributes(stats.conflicts.attributes) },
  ];

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption text-muted-foreground">{t.generatedAt(formatDateTime(stats.generatedAt, locale))}</p>
        <Button variant="ghost" size="sm" onClick={() => onSignOut(messages.moderator.signedOut)}>
          <SignOut weight="bold" aria-hidden />
          {messages.moderator.signOut}
        </Button>
      </div>
      <p className="mt-2 text-body-sm text-foreground/85">
        {stats.isSample ? null : `${t.intro} `}
        {t.introRules} {t.scope(excluded)}
      </p>
      <p className="mt-1 text-caption text-muted-foreground">{stats.isSample ? t.introSample : t.realOnly}</p>

      <InfoSection title={t.tiles.heading}>
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="flex flex-col rounded-[20px] bg-surface-raised p-4 ring-1 ring-border/70">
              <dt className="text-caption text-muted-foreground">{tile.label}</dt>
              <dd className="mt-1 font-display text-h2 font-bold">{tile.value}</dd>
              {tile.sub ? <dd className="text-caption text-muted-foreground">{tile.sub}</dd> : null}
            </div>
          ))}
        </dl>
      </InfoSection>

      <GusContext />

      <section className="mt-6" aria-labelledby={ids.needs}>
        <h2 id={ids.needs} className="mb-2 text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {t.needs.heading}
        </h2>
        <p className="text-body-sm text-foreground/85">{t.needs.lead}</p>
        {/* The bars repeat the table below for sighted users; screen readers get the table. */}
        <div aria-hidden className="mt-3 space-y-3 rounded-[20px] bg-surface-raised p-4 ring-1 ring-border/70">
          {stats.needs.map((row) => {
            const sum = STATES.reduce((s, state) => s + row[state], 0) || 1;
            return (
              <div key={row.need}>
                <p className="text-caption font-semibold">{t.needs.chartLabel(needName(row.need), row.barrier, sum)}</p>
                <div className="mt-1 flex h-4 overflow-hidden rounded-full bg-muted">
                  {STATES.map((state) =>
                    row[state] ? (
                      <div key={state} className={BAR[state]} style={{ width: `${(row[state] / sum) * 100}%` }} />
                    ) : null,
                  )}
                </div>
              </div>
            );
          })}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption">
            {STATES.map((state) => (
              <li key={state} className="flex items-center gap-1.5">
                <span className={cn("inline-block size-3 rounded-sm", BAR[state])} />
                {t.needs.state[state]}
              </li>
            ))}
          </ul>
        </div>
        <TableRegion label={t.needs.caption} className="mt-3">
          <table className="w-full border-collapse text-body-sm">
            <caption className="px-3 pt-3 text-left text-caption text-muted-foreground">{t.needs.caption}</caption>
            <thead>
              <tr>
                <th scope="col" className={headCell}>
                  {t.needs.need}
                </th>
                {STATES.map((state) => (
                  <th key={state} scope="col" className={cn(headCell, "text-right")}>
                    {t.needs.state[state]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.needs.map((row) => (
                <tr key={row.need}>
                  <th scope="row" className={cn(tableCell, "text-left font-semibold")}>
                    {needName(row.need)}
                  </th>
                  {STATES.map((state) => (
                    <td key={state} className={cn(tableCell, "text-right tabular-nums")}>
                      {row[state]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      </section>

      <section className="mt-6" aria-labelledby={ids.reports}>
        <h2 id={ids.reports} className="mb-2 text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {t.reports.heading}
        </h2>
        <TableRegion label={t.reports.caption}>
          <table className="w-full border-collapse text-body-sm">
            <caption className="px-3 pt-3 text-left text-caption text-muted-foreground">{t.reports.caption}</caption>
            <thead>
              <tr>
                <th scope="col" className={headCell}>
                  {t.reports.status}
                </th>
                <th scope="col" className={cn(headCell, "text-right")}>
                  {t.reports.count}
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.reports.map((row) => (
                <tr key={row.status}>
                  <th scope="row" className={cn(tableCell, "text-left font-normal")}>
                    {messages.moderator.status[row.status]}
                  </th>
                  <td className={cn(tableCell, "text-right tabular-nums")}>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      </section>

      <section className="mt-6" aria-labelledby={ids.priorities}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id={ids.priorities} className="text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {t.priorities.heading}
          </h2>
          {stats.priorities.items.length ? (
            <Button variant="outline" size="sm" onClick={() => void downloadCsv()}>
              <DownloadSimple weight="bold" aria-hidden />
              {t.priorities.exportCsv}
            </Button>
          ) : null}
        </div>
        <p className="text-body-sm text-foreground/85">{t.priorities.lead}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-body-sm">
          {stats.criteria.map((c) => (
            <li key={c.factor}>{t.priorities.criterion[c.factor](c.points, c.max, busy)}</li>
          ))}
        </ul>
        <p className="mt-2 text-caption text-muted-foreground">{t.priorities.noVisits}</p>

        {stats.priorities.items.length ? (
          <TableRegion label={t.priorities.regionLabel} className="mt-3">
            <table className="w-full min-w-[40rem] border-collapse text-body-sm">
              <caption className="px-3 pt-3 text-left text-caption text-muted-foreground">
                {t.priorities.caption(stats.priorities.items.length, stats.priorities.total)}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={cn(headCell, "text-right")}>
                    {t.priorities.rank}
                  </th>
                  <th scope="col" className={headCell}>
                    {t.priorities.place}
                  </th>
                  <th scope="col" className={headCell}>
                    {t.priorities.category}
                  </th>
                  <th scope="col" className={cn(headCell, "text-right")}>
                    {t.priorities.score}
                  </th>
                  <th scope="col" className={headCell}>
                    {t.priorities.action}
                  </th>
                  <th scope="col" className={headCell}>
                    {t.priorities.reasons}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.priorities.items.map((item) => (
                  <tr key={item.placeId}>
                    <td className={cn(tableCell, "text-right tabular-nums")}>{item.rank}</td>
                    <th scope="row" className={cn(tableCell, "text-left font-semibold")}>
                      <Link
                        href={routes.place(item.placeId)}
                        className="inline-flex min-h-6 items-center text-primary underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {item.placeName}
                      </Link>
                    </th>
                    <td className={tableCell}>{category(item.category).label}</td>
                    <td className={cn(tableCell, "text-right font-semibold tabular-nums")}>{item.score}</td>
                    <td className={tableCell}>
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-caption font-semibold whitespace-nowrap",
                          item.action === "fix"
                            ? "bg-status-barrier-bg text-status-barrier"
                            : "bg-status-unknown-bg text-status-unknown",
                        )}
                      >
                        {t.priorities.actionName[item.action]}
                      </span>
                    </td>
                    <td className={cn(tableCell, "text-caption")}>{reasonsText(item, messages)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
        ) : (
          <p className="mt-3 text-body-sm text-muted-foreground">{t.priorities.empty}</p>
        )}
      </section>
    </>
  );
}
