"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudSlash, Power } from "@phosphor-icons/react";
import type { SimulatedSourceOutage } from "@krakow-bez-barier/contracts";
import { Button, toast, useAnnounce } from "@krakow-bez-barier/ui";
import { DemoOutageTag } from "@/components/kbb";
import { bearer, StatusError } from "@/components/moderator/moderator-session";
import { useLocale, useMessages } from "@/i18n/client";
import { api } from "@/lib/api";
import { formatDateTime, retryMinutes } from "@/lib/moderation";
import { routes } from "@/lib/routes";

const QUERY_KEY = ["moderation", "source-outages"];

const fieldClass =
  "h-12 w-full rounded-2xl border border-input bg-card px-4 text-body outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * "Demo awarii źródła": the switch "Symuluj awarię źródła", so the jury can see a source outage on the live app. The
 * server keeps the switch (every instance sees it) and ends it by itself after `durationMinutes`.
 */
export function SourceOutagesTab({ token, onSignOut }: { token: string; onSignOut: (message: string) => void }) {
  const m = useMessages();
  const t = m.moderator.sourceOutages;
  const locale = useLocale();
  const announce = useAnnounce();
  const queryClient = useQueryClient();
  const heading = useRef<HTMLHeadingElement>(null);
  const selectId = useId();
  const [chosen, setChosen] = useState<string | null>(null);

  const simulations = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, response } = await api.GET("/moderation/source-outages", { headers: bearer(token) });
      if (!data) throw new StatusError(response.status, response.headers.get("retry-after"));
      return data;
    },
    retry: false,
  });
  const sources = useQuery({
    queryKey: ["sources", locale],
    queryFn: async () => {
      const { data, error } = await api.GET("/sources");
      if (error || !data) throw new Error(error?.title ?? "listSources failed");
      return data.items;
    },
  });

  // Only sources fetched from outside, with data to fall back on, can show a meaningful outage.
  const choices = (sources.data ?? []).filter((s) => s.kind !== "user_report" && s.lastSuccessAt);
  const sourceId = choices.some((s) => s.id === chosen) ? chosen! : (choices[0]?.id ?? "");

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["sources"] }),
    ]);
    heading.current?.focus();
  };

  const failed = (error: Error, fallback: string, notFound = fallback) => {
    const status = error instanceof StatusError ? error.status : null;
    if (status === 401) return onSignOut(m.moderator.sessionExpired);
    const message =
      status === 429
        ? t.tooMany(retryMinutes((error as StatusError).retryAfter))
        : status === 404
          ? notFound
          : fallback;
    toast.error(message);
    announce(message);
  };

  const start = useMutation({
    mutationFn: async (id: string) => {
      const { data, response } = await api.PUT("/moderation/source-outages/{sourceId}", {
        params: { path: { sourceId: id } },
        headers: bearer(token),
      });
      if (!data) throw new StatusError(response.status, response.headers.get("retry-after"));
      return data;
    },
    onSuccess: (simulation) => {
      const message = t.started(simulation.sourceName, formatDateTime(simulation.endsAt, locale));
      toast(message);
      announce(message);
    },
    onError: (error) => failed(error, t.startFailed),
    onSettled: refresh,
  });

  const stop = useMutation({
    mutationFn: async (simulation: SimulatedSourceOutage) => {
      const { data, response } = await api.DELETE("/moderation/source-outages/{sourceId}", {
        params: { path: { sourceId: simulation.sourceId } },
        headers: bearer(token),
      });
      if (!data) throw new StatusError(response.status, response.headers.get("retry-after"));
      return data;
    },
    onSuccess: (simulation) => {
      const message = t.stopped(simulation.sourceName);
      toast(message);
      announce(message);
    },
    onError: (error) => failed(error, t.stopFailed, t.gone),
    onSettled: refresh,
  });

  if (simulations.isPending || sources.isPending) {
    return (
      <p className="text-body-sm text-muted-foreground" aria-busy="true">
        {t.loading}
      </p>
    );
  }

  if (simulations.isError || sources.isError) {
    return (
      <div className="rounded-[20px] bg-status-barrier-bg p-4 text-body-sm text-status-barrier">
        <p>{t.loadFailed}</p>
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => {
            void simulations.refetch();
            void sources.refetch();
          }}
        >
          {m.moderator.retry}
        </Button>
      </div>
    );
  }

  const running = simulations.data.items;
  const busy = start.isPending || stop.isPending;

  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <h2
          ref={heading}
          tabIndex={-1}
          className="text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase outline-none"
        >
          {t.heading}
        </h2>
        <DemoOutageTag />
      </div>
      <p className="mb-3 text-caption text-muted-foreground">{t.lead(simulations.data.durationMinutes)}</p>

      {choices.length ? (
        <form
          className="rounded-[20px] bg-surface-raised p-4 ring-1 ring-border/70"
          onSubmit={(event) => {
            event.preventDefault();
            if (sourceId) start.mutate(sourceId);
          }}
        >
          <label htmlFor={selectId} className="mb-2 block text-body-sm font-semibold">
            {t.source}
          </label>
          <select id={selectId} value={sourceId} onChange={(e) => setChosen(e.target.value)} className={fieldClass}>
            {choices.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
          <Button type="submit" className="mt-3 w-full" disabled={busy}>
            <CloudSlash weight="bold" aria-hidden />
            {t.start}
          </Button>
          {start.isPending ? (
            <p className="mt-2 text-caption text-muted-foreground" aria-busy="true">
              {t.starting}
            </p>
          ) : null}
        </form>
      ) : (
        <p className="text-body-sm text-muted-foreground">{t.noSources}</p>
      )}

      <h3 className="mt-5 mb-2 text-body-sm font-semibold">{t.running}</h3>
      {running.length ? (
        <ul className="space-y-2">
          {running.map((simulation) => (
            <li key={simulation.sourceId} className="flex gap-3 rounded-2xl bg-status-conflict-bg p-4">
              <CloudSlash weight="bold" className="mt-0.5 size-5 shrink-0 text-status-conflict" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold">{t.entry(simulation.sourceName)}</p>
                <p className="mt-1 text-caption text-foreground">
                  {t.until(formatDateTime(simulation.endsAt, locale), simulation.startedBy)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    aria-label={t.stopLabel(simulation.sourceName)}
                    onClick={() => stop.mutate(simulation)}
                  >
                    <Power weight="bold" aria-hidden />
                    {t.stop}
                  </Button>
                  <Link
                    href={routes.aboutData}
                    className="inline-flex min-h-6 items-center text-caption font-semibold text-primary underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {t.showAboutData}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-sm text-muted-foreground">{t.none}</p>
      )}
    </section>
  );
}
