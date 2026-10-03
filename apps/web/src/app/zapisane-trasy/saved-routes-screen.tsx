"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CaretDown, ClockCounterClockwise, Trash } from "@phosphor-icons/react";
import { Button, cn, StatusIcon, useAnnounce } from "@krakow-bez-barier/ui";
import { ButtonLink } from "@/components/button-link";
import { SampleTag } from "@/components/kbb";
import { PlaceEntrance } from "@/components/route/place-entrance";
import { useLocale, useMessages } from "@/i18n/client";
import { intlLocale, type Locale } from "@/i18n/locale";
import { barrierList, cleanHeadline, gaps, routeStatus } from "@/lib/route-summary";
import { routes } from "@/lib/routes";
import { deleteSavedRoute, listSavedRoutes, type SavedRoute } from "@/lib/saved-routes";
import { StepList } from "../trasa/route-steps";

const plannedAt = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(intlLocale[locale], { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Warsaw" }).format(
    new Date(iso),
  );

/** The routes kept on this device, read from IndexedDB — no request, so it works offline. */
export function SavedRoutesScreen() {
  const t = useMessages().route.saved;
  const announce = useAnnounce();
  // undefined while loading; null when this browser can't store routes.
  const [list, setList] = useState<SavedRoute[] | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void listSavedRoutes().then((routes) => {
      if (active) setList(routes);
    });
    return () => {
      active = false;
    };
  }, []);

  const remove = async (saved: SavedRoute) => {
    const name = t.name(saved.startName, saved.endName);
    if (!(await deleteSavedRoute(saved.id))) {
      announce(t.deleteFailed);
      return;
    }
    setList((current) => current?.filter((r) => r.id !== saved.id));
    announce(t.deleted(name));
    // The focused button is gone with its route; the page takes focus so the keyboard starts from the top.
    document.getElementById("main")?.focus();
  };

  return (
    <>
      <p className="text-body text-muted-foreground">{t.lead}</p>
      {list === undefined ? (
        <p className="mt-4 text-body text-muted-foreground">{t.loading}</p>
      ) : list === null || list.length === 0 ? (
        <div className="mt-4 grid justify-items-start gap-3">
          <p className="text-body font-semibold">{list === null ? t.unavailable : t.empty}</p>
          <ButtonLink href={routes.route()}>{t.plan}</ButtonLink>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((saved) => (
            <li key={saved.id}>
              <SavedRouteItem saved={saved} onDelete={() => void remove(saved)} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function SavedRouteItem({ saved, onDelete }: { saved: SavedRoute; onDelete: () => void }) {
  const m = useMessages();
  const t = m.route;
  const locale = useLocale();
  const { route } = saved;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const stepRefs = useRef(new Map<number, HTMLButtonElement>());
  const headingId = useId();
  const detailsId = useId();
  const name = t.saved.name(saved.startName, saved.endName);
  const status = route.fallback ? "barrier" : routeStatus(route);
  const verdict = route.fallback ? t.noneOk : route.knownBarrierCount ? t.hasBarriers(barrierList(route)) : cleanHeadline(t, route);

  return (
    <article aria-labelledby={headingId} className="rounded-[20px] bg-surface-raised p-4 shadow-soft ring-1 ring-border/70">
      <h2 id={headingId} className="text-title font-semibold">
        {name}
        {saved.start?.isSample || saved.destination?.isSample ? <SampleTag className="ml-2 align-middle" /> : null}
      </h2>
      <p className="mt-0.5 text-body-sm text-muted-foreground">
        {t.minutes(route.durationMinutes)} · {t.distance(route.distanceMeters)} · {route.kind === "avoid_stairs" ? t.avoidStairs : t.shortest}
      </p>
      <p className={cn("mt-2 flex items-start gap-2 text-body-sm font-semibold", status === "barrier" ? "text-status-barrier" : "text-foreground")}>
        <StatusIcon status={status} className="mt-0.5 size-4 shrink-0" />
        {verdict}
      </p>
      <p className="mt-0.5 pl-6 text-caption text-muted-foreground">{gaps(t, route)}</p>
      <p className="mt-2 flex items-start gap-2 rounded-2xl bg-muted p-3 text-body-sm">
        <ClockCounterClockwise weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {t.saved.plannedAt(plannedAt(saved.plannedAt, locale))} {t.saved.stale}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((o) => !o)}>
          <CaretDown weight="bold" className={cn("transition-transform", open && "rotate-180")} />
          {open ? t.saved.hide : t.saved.show}
        </Button>
        <Button variant="outline" size="sm" aria-label={t.saved.deleteAria(name)} onClick={onDelete}>
          <Trash weight="bold" />
          {t.saved.delete}
        </Button>
      </div>
      <div id={detailsId} hidden={!open}>
        {open ? (
          <>
            <h3 className="mt-5 mb-1 text-body font-semibold">{t.steps}</h3>
            <StepList route={route} selected={selected} onSelect={setSelected} stepRefs={stepRefs} idPrefix={`${detailsId}-odcinek`} />
            {route.attribution ? (
              <p className="mt-3 text-caption text-muted-foreground">
                {t.attribution}: {route.attribution}
              </p>
            ) : null}
            {saved.start ? <PlaceEntrance place={saved.start} title={t.saved.startTitle} level={3} /> : null}
            {saved.destination ? <PlaceEntrance place={saved.destination} title={t.destination.title} level={3} /> : null}
          </>
        ) : null}
      </div>
    </article>
  );
}
