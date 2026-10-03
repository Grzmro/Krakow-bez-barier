"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "@phosphor-icons/react";
import type { PlaceSummary } from "@krakow-bez-barier/contracts";
import { Button, LabeledSwitch, STATUSES, StatusIcon, useAnnounce, type Status } from "@krakow-bez-barier/ui";
import { SampleTag, StatusBadge } from "@/components/kbb";
import { pl } from "@/i18n/pl";
import { usePlaces } from "@/lib/api/places";
import { profileQuery } from "@/lib/profile/thresholds";
import { useProfile } from "@/lib/profile/use-profile";
import { NeedGroups } from "./need-groups";
import { ProfileSwitch } from "./profile-switch";
import { ThresholdsDrawer } from "./thresholds-drawer";

const t = pl.profile;

const STATUS_ORDER: Status[] = ["met", "conflict", "unknown", "barrier"];

function countByStatus(items: PlaceSummary[]): Record<Status, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const item of items) if (item.verdict) counts[item.verdict.state] += 1;
  return counts;
}

function Counters({ counts }: { counts: Record<Status, number> }) {
  return (
    <ul aria-label={t.countersLabel} className="flex min-w-0 items-center gap-2">
      {STATUS_ORDER.map((status) => (
        <li key={status} className="flex h-11 min-w-0 items-center gap-1.5 rounded-full bg-card px-3 ring-1 ring-border">
          <StatusIcon status={status} className="size-5!" />
          <span aria-hidden className="font-num text-[17px] text-foreground">
            {counts[status]}
          </span>
          <span className="sr-only">{t.counter(counts[status], pl.common.status[status])}</span>
        </li>
      ))}
    </ul>
  );
}

function PlaceRow({ place }: { place: PlaceSummary }) {
  const [open, setOpen] = useState(false);
  const detailsId = `need-groups-${place.id}`;
  const verdict = place.verdict;
  const address = [place.address?.street, place.address?.houseNumber].filter(Boolean).join(" ");
  const facts = place.summary.map((chip) => chip.label).filter(Boolean).join(" · ");
  return (
    <li className="rounded-(--radius-card) bg-surface-raised p-3 shadow-soft ring-1 ring-border/70">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {verdict ? (
            <StatusBadge
              status={verdict.state}
              reason={verdict.state === "met" ? undefined : verdict.reasons[0]}
              unconfirmed={verdict.unconfirmed}
              className="max-w-full"
            />
          ) : null}
          <h3 className="mt-1.5 text-[17px] leading-6 font-semibold">{place.name}</h3>
          {address ? <p className="text-caption text-muted-foreground">{address}</p> : null}
          {!verdict && facts ? <p className="mt-1 text-caption font-medium text-foreground/80">{facts}</p> : null}
        </div>
        {place.isSample ? <SampleTag /> : null}
      </div>
      {verdict?.needs?.length ? (
        <>
          <Button
            variant="link"
            size="sm"
            className="-ml-4 h-10"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? t.list.hideDetails : t.list.details}
          </Button>
          <div id={detailsId} hidden={!open}>
            {open ? <NeedGroups verdict={verdict} headingLevel={4} /> : null}
          </div>
        </>
      ) : null}
    </li>
  );
}

/**
 * Profile switch, thresholds and verdicts over the place list. Built on the shared hooks so the
 * home screen (KBB-23) and the place card (KBB-14) can take over its pieces.
 */
export function ProfilePlaces() {
  const { settings, setProfile } = useProfile();
  const [q, setQ] = useState("");
  const [hideFailing, setHideFailing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const announce = useAnnounce();

  const { data, isPending, isError, isPlaceholderData } = usePlaces({ q: q || undefined, ...profileQuery(settings) });
  const items = useMemo(() => data?.items ?? [], [data]);
  const active = settings.profile;
  const shown = useMemo(() => {
    if (!active) return items;
    const visible = hideFailing ? items.filter((p) => p.verdict?.state !== "barrier") : items;
    return visible.toSorted((a, b) => STATUS_ORDER.indexOf(a.verdict?.state ?? "unknown") - STATUS_ORDER.indexOf(b.verdict?.state ?? "unknown"));
  }, [items, active, hideFailing]);
  const counts = useMemo(() => countByStatus(shown), [shown]);
  const hidden = items.length - shown.length;

  useEffect(() => {
    if (!data || isPlaceholderData) return;
    announce(t.announce(active, shown.length, hidden, counts));
  }, [announce, data, isPlaceholderData, active, shown.length, hidden, counts]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-body-sm font-semibold">
        {t.list.search}
        <input
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t.list.searchHint}
          className="h-12 rounded-full border-[1.5px] border-border-strong/50 bg-card px-4 text-body font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      </label>

      <ProfileSwitch value={active} onChange={setProfile} />

      {active ? (
        <>
          <div className="flex items-center gap-2">
            {/* TODO(KBB-23): counters become status-filter toggles on the home screen. */}
            <Counters counts={counts} />
            <Button variant="outline" size="icon" aria-label={t.settings} onClick={() => setDrawerOpen(true)} className="ml-auto size-11 shrink-0">
              <SlidersHorizontal weight="bold" />
            </Button>
          </div>
          <LabeledSwitch label={t.hideFailing} checked={hideFailing} onCheckedChange={setHideFailing} className="-my-1" />
        </>
      ) : (
        <p className="text-caption text-muted-foreground">{t.list.noProfile}</p>
      )}

      <section aria-labelledby="places-heading" className="flex flex-col gap-2.5">
        <h2 id="places-heading" className="flex items-center justify-between text-caption font-semibold text-muted-foreground">
          {t.list.heading} · {t.list.results(shown.length)}
        </h2>
        {isPending ? <p className="text-body-sm">{t.list.loading}</p> : null}
        {isError ? <p className="text-body-sm text-destructive">{t.list.error}</p> : null}
        {!isPending && !isError && shown.length === 0 ? <p className="text-body-sm">{t.list.empty}</p> : null}
        <ul className="flex flex-col gap-2.5">
          {shown.map((place) => (
            <PlaceRow key={place.id} place={place} />
          ))}
        </ul>
      </section>

      <ThresholdsDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
