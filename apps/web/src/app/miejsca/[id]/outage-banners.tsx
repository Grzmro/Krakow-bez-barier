"use client";

import { forwardRef } from "react";
import { CheckCircle, HandPalm, Wrench } from "@phosphor-icons/react";
import type { Outage, OutageVote } from "@krakow-bez-barier/contracts";
import { Button } from "@krakow-bez-barier/ui";
import { ReliabilityBadge } from "@/components/kbb";
import { useLocale, useMessages } from "@/i18n/client";
import { relativeTime } from "@/lib/outages";

type Props = {
  outages: Outage[];
  now: Date;
  hasVoted: (outageId: string, vote: OutageVote) => boolean;
  onVote: (outage: Outage, vote: OutageVote) => void;
  /** Registers each banner's "Działa" button, so focus can move to it when "Potwierdzam awarię" disappears. */
  workingRef: (outageId: string, element: HTMLButtonElement | null) => void;
};

/** "Zgłoszona awaria windy · 2 potwierdzenia · 20 min temu" banners with the community's two answers. */
export const OutageBanners = forwardRef<HTMLElement, Props>(function OutageBanners(
  { outages, now, hasVoted, onVote, workingRef },
  ref,
) {
  const t = useMessages().place.breakdown;
  const locale = useLocale();
  if (outages.length === 0) return null;
  return (
    <section ref={ref} tabIndex={-1} aria-labelledby="place-outages" className="mt-5 scroll-mt-20">
      <h2 id="place-outages" className="sr-only">
        {t.heading}
      </h2>
      <ul className="space-y-3">
        {outages.map((outage) => {
          const titleId = `outage-${outage.id}`;
          const confirmed = outage.state === "confirmed";
          return (
            <li key={outage.id} className="flex gap-3 rounded-2xl bg-status-barrier-bg p-4">
              <Wrench weight="fill" className="mt-0.5 size-6 shrink-0 text-status-barrier" aria-hidden />
              <div className="min-w-0 flex-1">
                <p id={titleId} className="text-body-sm font-semibold text-status-barrier">
                  {t.title(outage.equipment)} · {t.confirmations(outage.confirmations)} ·{" "}
                  <time dateTime={outage.lastConfirmedAt}>{relativeTime(outage.lastConfirmedAt, now, locale)}</time>
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-foreground">
                  <ReliabilityBadge value="unverified" />
                  {confirmed ? <span className="font-semibold">{t.communityConfirmed}</span> : null}
                </p>
                <p className="mt-1 text-caption text-foreground">{t.source}</p>
                <p className="mt-0.5 text-caption text-foreground">
                  {t.expires(relativeTime(outage.expiresAt, now, locale))}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {hasVoted(outage.id, "still_broken") ? null : (
                    <Button variant="outline" size="sm" aria-describedby={titleId} onClick={() => onVote(outage, "still_broken")}>
                      <HandPalm weight="bold" />
                      {t.confirm}
                    </Button>
                  )}
                  {hasVoted(outage.id, "working") ? null : (
                    <Button
                      ref={(element) => workingRef(outage.id, element)}
                      variant="outline"
                      size="sm"
                      aria-describedby={titleId}
                      onClick={() => onVote(outage, "working")}
                    >
                      <CheckCircle weight="bold" />
                      {t.working}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
});
