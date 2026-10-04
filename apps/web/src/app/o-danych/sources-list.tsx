"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowSquareOut, CheckCircle, ClockCountdown, CloudSlash, Question, type Icon } from "@phosphor-icons/react";
import type { Source } from "@krakow-bez-barier/contracts";
import { Button, cn, useAnnounce } from "@krakow-bez-barier/ui";
import { DemoOutageTag, SampleTag, SourceText } from "@/components/kbb";
import { useLocale, useMessages } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import { api, isMockApi } from "@/lib/api";

// Source health, not a place verdict: never the red "Nie spełnia" tone, and its own icon per state.
const REFRESH_CHIP: Record<Source["refreshStatus"], { icon: Icon; className: string }> = {
  ok: { icon: CheckCircle, className: "bg-status-met-bg text-status-met" },
  stale: { icon: ClockCountdown, className: "bg-status-conflict-bg text-status-conflict" },
  outage: { icon: CloudSlash, className: "bg-status-conflict-bg text-status-conflict" },
  never: { icon: Question, className: "bg-status-unknown-bg text-status-unknown" },
};

function RefreshStatusChip({ status }: { status: Source["refreshStatus"] }) {
  const t = useMessages().pages.aboutData;
  const { icon: StatusIcon, className } = REFRESH_CHIP[status];
  return (
    <span
      data-refresh-status={status}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        className,
      )}
    >
      <StatusIcon weight="bold" className="size-3.5" aria-hidden />
      {t.status[status]}
    </span>
  );
}

function formatDate(iso: string | null | undefined, t: Messages["pages"]["aboutData"]) {
  if (!iso) return t.never;
  return new Intl.DateTimeFormat(t.dateLocale, { dateStyle: "medium", timeStyle: "short", timeZone: t.timeZone }).format(
    new Date(iso),
  );
}

// An unknown cadence means we imported the data once; a source never fetched has no cadence at all.
function refreshLabel(source: Source, labels: Partial<Record<string, string>>) {
  const interval = source.refreshInterval;
  if (!interval || (interval === "unknown" && source.refreshStatus === "never")) return "—";
  return labels[interval] ?? interval;
}

async function fetchSources() {
  const { data, error } = await api.GET("/sources");
  if (error || !data) throw new Error(error?.title ?? "listSources failed");
  return data.items;
}

export function SourcesList() {
  const t = useMessages().pages.aboutData;
  const refreshIntervalLabels: Partial<Record<string, string>> = t.refreshInterval;
  const announce = useAnnounce();
  const locale = useLocale();
  const query = useQuery({ queryKey: ["sources", locale], queryFn: fetchSources });

  useEffect(() => {
    if (query.isSuccess) announce(t.loaded(query.data.length));
    if (query.isError) announce(t.error);
  }, [announce, query.isSuccess, query.isError, query.data, t]);

  if (query.isPending) {
    return (
      <p className="text-body-sm text-muted-foreground" aria-busy="true">
        {t.loading}
      </p>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-[20px] bg-status-barrier-bg p-4 text-body-sm text-status-barrier">
        <p>{t.error}</p>
        <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
          {t.retry}
        </Button>
      </div>
    );
  }

  return (
    <>
      {isMockApi ? (
        <p className="mb-2.5 flex items-center gap-2 text-caption text-muted-foreground">
          <SampleTag />
          {t.sampleNote}
        </p>
      ) : null}
      <ul className="grid gap-2.5 lg:grid-cols-2">
        {query.data.map((source) => (
          <li key={source.id} className="rounded-[20px] bg-surface-raised p-4 shadow-soft ring-1 ring-border/70">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-body-sm font-semibold">
                <SourceText>{source.name}</SourceText>
                {source.isSample ? <SampleTag className="ml-1.5 align-middle" /> : null}
              </h3>
              <RefreshStatusChip status={source.refreshStatus} />
            </div>
            {source.refreshStatus === "outage" ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm font-semibold text-status-conflict">
                {source.lastSuccessAt ? t.refreshFailed(formatDate(source.lastSuccessAt, t)) : t.refreshFailedNoData}
                {source.simulatedOutage ? <DemoOutageTag /> : null}
              </p>
            ) : null}
            {source.statusNote ? <p className="mt-2 text-caption text-foreground/85">{source.statusNote}</p> : null}
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-caption">
              <dt className="text-muted-foreground">{t.license}</dt>
              <dd>
                <SourceText license>{source.license}</SourceText>
              </dd>
              {source.attribution ? (
                <>
                  <dt className="text-muted-foreground">{t.attribution}</dt>
                  <dd>
                    <SourceText>{source.attribution}</SourceText>
                  </dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">{t.refresh}</dt>
              <dd>{refreshLabel(source, refreshIntervalLabels)}</dd>
              <dt className="text-muted-foreground">{t.verification}</dt>
              <dd>{t.verificationByKind[source.kind]}</dd>
              <dt className="text-muted-foreground">{t.lastOk}</dt>
              <dd className="tabular-nums">{formatDate(source.lastSuccessAt, t)}</dd>
              {source.refreshStatus !== "ok" ? (
                <>
                  <dt className="text-muted-foreground">{t.lastAttempt}</dt>
                  <dd className="tabular-nums">{formatDate(source.lastAttemptAt, t)}</dd>
                </>
              ) : null}
            </dl>
            {source.url ? (
              <a
                href={source.url}
                className="mt-2 inline-flex min-h-6 items-center gap-1 text-caption font-semibold text-primary underline underline-offset-2"
              >
                {t.websiteLabel} <SourceText>{source.name}</SourceText>
                <ArrowSquareOut weight="bold" className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
