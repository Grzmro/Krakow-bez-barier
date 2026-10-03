"use client";

import { useRef } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Trash, Wrench } from "@phosphor-icons/react";
import type { ModerationOutage, ModeratorSession } from "@krakow-bez-barier/contracts";
import { Button, toast, useAnnounce } from "@krakow-bez-barier/ui";
import { ReliabilityBadge } from "@/components/kbb";
import { bearer, StatusError } from "@/components/moderator/moderator-session";
import { useLocale, useMessages } from "@/i18n/client";
import { api, isMockApi } from "@/lib/api";
import { relativeTime } from "@/lib/outages";
import { routes } from "@/lib/routes";

const QUERY_KEY = ["moderation", "outages"];

/** Active outages of every place, for the "Awarie" tab (and its count in the tab label). */
export function useModerationOutages(token: string) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, response } = await api.GET("/moderation/outages", { headers: bearer(token) });
      if (!data) throw new StatusError(response.status, response.headers.get("retry-after"));
      return data.items;
    },
    retry: false,
  });
}

type Props = {
  token: string;
  query: UseQueryResult<ModerationOutage[]>;
  session: ModeratorSession | undefined;
  onSignOut: (message: string) => void;
};

/** "Awarie": visitor outages published without moderation, each with "Usuń" for spam or a false report. */
export function OutagesTab({ token, query, session, onSignOut }: Props) {
  const m = useMessages();
  const t = m.moderator.outages;
  const locale = useLocale();
  const announce = useAnnounce();
  const queryClient = useQueryClient();
  const heading = useRef<HTMLHeadingElement>(null);

  const remove = useMutation({
    mutationFn: async (outage: ModerationOutage) => {
      const { data, response } = await api.DELETE("/moderation/outages/{outageId}", {
        params: { path: { outageId: outage.id } },
        headers: bearer(token),
      });
      if (!data) throw new StatusError(response.status);
      return data;
    },
    onSuccess: () => {
      const message = isMockApi
        ? t.removedMock
        : session?.demo && session.revertsAfterMinutes
          ? t.removedDemo(session.revertsAfterMinutes)
          : t.removed;
      toast(message);
      announce(message);
    },
    onError: (error) => {
      if (error instanceof StatusError && error.status === 401) return onSignOut(m.moderator.sessionExpired);
      const message = error instanceof StatusError && (error.status === 409 || error.status === 404) ? t.gone : t.failed;
      toast.error(message);
      announce(message);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      heading.current?.focus();
    },
  });

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
        <p>{t.loadFailed}</p>
        <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
          {m.moderator.retry}
        </Button>
      </div>
    );
  }

  const outages = query.data;
  const now = new Date();

  return (
    <section>
      <h2
        ref={heading}
        tabIndex={-1}
        className="mb-1 text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase outline-none"
      >
        {t.heading(outages.length)}
      </h2>
      <p className="mb-3 text-caption text-muted-foreground">{t.lead}</p>
      {outages.length ? (
        <ul className="space-y-2">
          {outages.map((outage) => {
            const equipment = m.common.attribute[outage.equipment];
            const titleId = `moderation-outage-${outage.id}`;
            return (
              <li key={outage.id} className="flex gap-3 rounded-2xl bg-surface-raised p-4 ring-1 ring-border/70">
                <Wrench weight="fill" className="mt-0.5 size-5 shrink-0 text-status-barrier" aria-hidden />
                <div className="min-w-0 flex-1">
                  <h3 id={titleId} className="text-body-sm font-semibold">
                    {t.title(equipment, outage.placeName)}
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
                    <ReliabilityBadge value="unverified" />
                    {outage.state === "confirmed" ? <span className="font-semibold">{m.place.breakdown.communityConfirmed}</span> : null}
                  </p>
                  <p className="mt-1 text-caption text-foreground/85">
                    {m.place.breakdown.confirmations(outage.confirmations)} · {t.working(outage.workingVotes)} ·{" "}
                    <time dateTime={outage.reportedAt}>{t.reported(relativeTime(outage.reportedAt, now, locale))}</time>
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={remove.isPending}
                      aria-label={t.removeLabel(equipment, outage.placeName)}
                      onClick={() => remove.mutate(outage)}
                    >
                      <Trash weight="bold" aria-hidden />
                      {t.remove}
                    </Button>
                    <Link
                      href={routes.place(outage.placeId)}
                      aria-label={m.moderator.showOnCardLabel(outage.placeName)}
                      className="inline-flex min-h-6 items-center text-caption font-semibold text-primary underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {m.moderator.showOnCard}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-body-sm text-muted-foreground">{t.empty}</p>
      )}
      {remove.isPending ? (
        <p className="mt-2 text-caption text-muted-foreground" aria-busy="true">
          {t.removing}
        </p>
      ) : null}
    </section>
  );
}
