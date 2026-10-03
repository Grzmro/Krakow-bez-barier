"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowSquareOut,
  ArrowsHorizontal,
  Armchair,
  Baby,
  Building,
  Car,
  CloudSlash,
  Database,
  Elevator,
  EnvelopeSimple,
  Globe,
  GridFour,
  HandPalm,
  Info,
  MapPin,
  NavigationArrow,
  PencilSimple,
  Phone,
  Plus,
  ShareNetwork,
  Stairs,
  Toilet,
  TrendUp,
  WarningDiamond,
  type Icon,
} from "@phosphor-icons/react";
import type { AccessibilityAttribute, Place } from "@krakow-bez-barier/contracts";
import { Button, buttonVariants, cn, toast, useAnnounce } from "@krakow-bez-barier/ui";
import { FactRow, ReliabilityBadge, SampleTag } from "@/components/kbb";
import { pl } from "@/i18n/pl";
import { api } from "@/lib/api";
import { useCategoryLookup } from "@/lib/categories";
import { CARD_ATTRIBUTES, factViews, failedSources, formatDate, latestSourceDate, osmEditUrl } from "@/lib/place-facts";
import { withPending, type PendingEntry } from "@/lib/reports";
import { usePlaceReports } from "@/lib/use-place-reports";
import { routes } from "@/lib/routes";
import { ReportDrawer, type ReportMode, type ReportSubmission } from "./report-drawer";

const t = pl.place;

const FACT_ICON: Partial<Record<AccessibilityAttribute, Icon>> = {
  step_count: Stairs,
  step_height_cm: Stairs,
  threshold_cm: Stairs,
  door_width_cm: ArrowsHorizontal,
  ramp: TrendUp,
  lift: Elevator,
  levels: Building,
  surface: GridFour,
  toilet_accessible: Toilet,
  bench: Armchair,
  disabled_parking: Car,
  changing_table: Baby,
};

export function PlaceScreen({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["place", id],
    queryFn: async () => {
      const { data, response } = await api.GET("/places/{id}", { params: { path: { id } } });
      if (response.status === 404) return null;
      if (!data) throw new Error(`getPlace ${response.status}`);
      return data;
    },
  });

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
  return <PlaceCard place={query.data} />;
}

function PlaceCard({ place }: { place: Place }) {
  const [contactOpen, setContactOpen] = useState(false);
  const focusContact = useRef(false);
  const contactRef = useRef<HTMLDivElement>(null);
  const announce = useAnnounce();
  const reports = usePlaceReports(place.id);
  const notRightButtons = useRef(new Map<AccessibilityAttribute, HTMLButtonElement>());
  const [openFacts, setOpenFacts] = useState<Partial<Record<AccessibilityAttribute, boolean>>>({});
  const [drawer, setDrawer] = useState<{ open: boolean; mode: ReportMode; attribute: AccessibilityAttribute; key: number }>({
    open: false,
    mode: "correct",
    attribute: CARD_ATTRIBUTES[0],
    key: 0,
  });
  const facts = withPending(factViews(place), reports.entries);
  const osmEdit = osmEditUrl(place);
  const failed = failedSources(place);
  const conflicts = facts.filter((f) => f.conflict);
  const firstUnknown = facts.find((f) => f.unknown);
  const latest = latestSourceDate(place);
  const contact = place.contact;
  const hasContact = !!(contact?.phone || contact?.website || contact?.email);
  const category = useCategoryLookup()(place.category);
  const CategoryIcon = category.icon;
  const address = [
    [place.address?.street, place.address?.houseNumber].filter(Boolean).join(" "),
    place.address?.city,
  ]
    .filter(Boolean)
    .join(", ");

  useEffect(() => {
    if (!contactOpen || !focusContact.current) return;
    focusContact.current = false;
    contactRef.current?.focus();
  }, [contactOpen]);

  // The hint's button disappears once the contact is open, so focus follows to the details.
  const openContactFromHint = () => {
    focusContact.current = true;
    setContactOpen(true);
  };

  const openReport = (mode: ReportMode, attribute: AccessibilityAttribute) =>
    setDrawer((d) => ({ open: true, mode, attribute, key: d.key + 1 }));

  const submitReport = ({ attribute, value, valueText, comment }: ReportSubmission) => {
    setDrawer((d) => ({ ...d, open: false }));
    setOpenFacts((o) => ({ ...o, [attribute]: true }));
    reports.submitReport({ attribute, value, comment }, valueText);
  };

  // "Potwierdzam" disappears once the confirmation is listed, so focus moves to the row's other action first.
  const confirmFact = async (attribute: AccessibilityAttribute, factId: string, valueText?: string) => {
    const ok = await reports.confirm(attribute, factId, valueText);
    if (ok) notRightButtons.current.get(attribute)?.focus();
  };

  const share = async () => {
    const url = new URL(routes.place(place.id), window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      toast(t.shared, { description: url });
      announce(t.shared);
    } catch {
      toast(t.shareFailed, { description: url });
      announce(t.shareFailed);
    }
  };

  return (
    <article aria-labelledby="place-name">
      <div className="relative grid h-[132px] place-items-center overflow-hidden rounded-[20px] bg-primary-container">
        <span aria-hidden className="grid size-14 place-items-center rounded-full bg-card text-primary shadow-float">
          <CategoryIcon weight="duotone" className="size-7" />
        </span>
        <span className="absolute bottom-3 left-3 rounded-full bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {t.noPhoto}
        </span>
        {place.isSample ? <SampleTag className="absolute right-3 bottom-3" /> : null}
      </div>

      <h1 id="place-name" className="mt-4 font-display text-h1 font-bold">
        {place.name}
      </h1>
      <p className="mt-1 text-body-sm text-muted-foreground">
        {category.label}
        {address ? ` · ${address}` : null}
      </p>
      <p className="mt-3 flex gap-2 text-body-sm">
        <MapPin weight="fill" className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden />
        <span>
          <span className="sr-only">{t.location}: </span>
          {place.entranceHint ?? <span className="text-muted-foreground">{t.noEntranceHint}</span>}
        </span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={routes.route(place.id)} className={buttonVariants({ size: "sm" })}>
          <NavigationArrow weight="fill" />
          {t.route}
        </Link>
        <Button variant="outline" size="sm" onClick={share}>
          <ShareNetwork weight="bold" />
          {t.share}
        </Button>
        {hasContact ? (
          <Button
            variant="outline"
            size="sm"
            aria-expanded={contactOpen}
            aria-controls="place-contact"
            onClick={() => setContactOpen(!contactOpen)}
          >
            <Phone weight="bold" />
            {t.contact}
          </Button>
        ) : null}
        <a href="#skad-wiemy" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Database weight="bold" />
          {t.why.title}
        </a>
      </div>
      {hasContact ? (
        <div
          id="place-contact"
          ref={contactRef}
          tabIndex={-1}
          hidden={!contactOpen}
          className="mt-3 space-y-2 rounded-2xl bg-muted p-3 text-body-sm"
        >
          {contact?.phone ? (
            <p className="flex items-center gap-2">
              <Phone weight="fill" className="size-4 text-primary" aria-hidden />
              <span className="text-muted-foreground">{t.phone}:</span>
              <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="font-semibold tabular-nums underline">
                {contact.phone}
              </a>
              {place.isSample ? <SampleTag className="ml-auto" /> : null}
            </p>
          ) : null}
          {contact?.website ? (
            <p className="flex items-center gap-2">
              <Globe weight="fill" className="size-4 text-primary" aria-hidden />
              <span className="text-muted-foreground">{t.www}:</span>
              <a href={contact.website} target="_blank" rel="noopener noreferrer" className="font-semibold break-all underline">
                {contact.website.replace(/^https?:\/\//, "")}
              </a>
            </p>
          ) : null}
          {contact?.email ? (
            <p className="flex items-center gap-2">
              <EnvelopeSimple weight="fill" className="size-4 text-primary" aria-hidden />
              <span className="text-muted-foreground">{t.email}:</span>
              <a href={`mailto:${contact.email}`} className="font-semibold break-all underline">
                {contact.email}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      {failed.map((source) => (
        <div key={source.id} className="mt-5 flex gap-3 rounded-2xl bg-status-conflict-bg p-4">
          <CloudSlash weight="bold" className="mt-0.5 size-6 shrink-0 text-status-conflict" aria-hidden />
          <div>
            <p className="text-body-sm font-semibold text-status-conflict">
              {source.lastSuccessAt ? t.outage.title(formatDate(source.lastSuccessAt)) : t.outage.titleNoDate}
            </p>
            <p className="mt-0.5 text-caption text-foreground">{t.outage.source(source.name)}</p>
            {source.statusNote ? <p className="mt-0.5 text-caption text-foreground">{source.statusNote}</p> : null}
          </div>
        </div>
      ))}

      {conflicts.length ? (
        <div className="mt-3 flex gap-3 rounded-2xl bg-status-conflict-bg p-4">
          <WarningDiamond weight="fill" className="mt-0.5 size-6 shrink-0 text-status-conflict" aria-hidden />
          <div>
            <p className="text-body-sm font-semibold text-status-conflict">{t.conflict.title}</p>
            <p className="mt-0.5 text-caption text-foreground">
              {t.conflict.body(conflicts.map((f) => f.label).join(", "))}
            </p>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="place-facts">
        <h2 id="place-facts" className="mt-6 mb-1 text-title font-semibold">
          {t.facts}
        </h2>
        <p className="mb-3 text-caption text-muted-foreground">{t.factsHint}</p>
        <ul className="divide-y divide-border overflow-hidden rounded-[20px] bg-surface-raised shadow-soft ring-1 ring-border">
          {facts.map((fact) => {
            const I = FACT_ICON[fact.attribute];
            const confirmId = fact.pending.some((p) => p.kind === "confirmation") ? undefined : fact.confirmFactId;
            return (
              <FactRow
                key={fact.attribute}
                open={!!openFacts[fact.attribute]}
                onOpenChange={(open) => setOpenFacts((o) => ({ ...o, [fact.attribute]: open }))}
                notice={fact.pending.length ? <PendingList entries={fact.pending} /> : undefined}
                icon={I ? <I /> : undefined}
                label={fact.label}
                value={fact.value}
                unit={fact.unit}
                reliability={fact.reliability}
                sources={fact.sources}
                actions={
                  fact.unknown ? (
                    <Button variant="outline" size="sm" onClick={() => openReport("fill", fact.attribute)}>
                      <Plus weight="bold" />
                      {t.fill}
                    </Button>
                  ) : (
                    <>
                      <Button
                        ref={(el) => {
                          if (el) notRightButtons.current.set(fact.attribute, el);
                          else notRightButtons.current.delete(fact.attribute);
                        }}
                        variant="outline"
                        size="sm"
                        onClick={() => openReport("correct", fact.attribute)}
                      >
                        <PencilSimple weight="bold" />
                        {t.notRight}
                      </Button>
                      {confirmId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmFact(fact.attribute, confirmId, fact.unit ? `${fact.value} ${fact.unit}` : fact.value)}
                        >
                          <HandPalm weight="bold" />
                          {t.confirm}
                        </Button>
                      ) : null}
                    </>
                  )
                }
              />
            );
          })}
        </ul>
      </section>

      {firstUnknown ? (
        <div className="mt-5 rounded-[20px] border border-dashed border-status-unknown bg-status-unknown-bg p-4">
          <p className="text-body-sm font-semibold">{t.contactHint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => openReport("fill", firstUnknown.attribute)}>
              <Plus weight="bold" />
              {t.fill}
            </Button>
            {hasContact && !contactOpen ? (
              <Button variant="outline" size="sm" aria-controls="place-contact" aria-expanded={false} onClick={openContactFromHint}>
                <Phone weight="bold" />
                {t.contact}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <section id="skad-wiemy" aria-labelledby="place-why" className="mt-8 scroll-mt-20">
        <h2 id="place-why" className="text-title font-semibold">
          {t.why.title}
        </h2>
        <p className="mt-1 text-caption text-muted-foreground">{t.why.lead}</p>
        {place.sources.length ? (
          <ul className="mt-3 space-y-2">
            {place.sources.map((source) => (
              <li key={source.id} className="rounded-2xl bg-surface-raised p-3 ring-1 ring-border">
                <p className="flex flex-wrap items-center gap-x-2 text-body-sm font-semibold">
                  {source.name}
                  {source.isSample ? <SampleTag /> : null}
                </p>
                <p className="mt-0.5 text-caption text-muted-foreground">
                  {t.sourceKind[source.kind]} · {t.why.license}: {source.license}
                </p>
                <p
                  className={cn(
                    "mt-0.5 flex items-center gap-1 text-caption font-semibold",
                    source.refreshStatus === "outage" ? "text-status-conflict" : "text-foreground",
                  )}
                >
                  {source.refreshStatus === "outage" ? <CloudSlash className="size-3.5" aria-hidden /> : null}
                  {t.refreshStatus[source.refreshStatus]} · {t.why.lastSuccess}{" "}
                  {source.lastSuccessAt ? formatDate(source.lastSuccessAt) : t.why.never}
                </p>
                {source.attribution ? <p className="mt-0.5 text-caption text-muted-foreground">{source.attribution}</p> : null}
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-10 px-0")}
                  >
                    {source.url.replace(/^https?:\/\//, "")}
                    <ArrowSquareOut aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-body-sm text-muted-foreground">{t.why.none}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-caption text-muted-foreground">
            <Database className="size-4" aria-hidden />
            {t.sourcesCount(place.sources.length, latest ? formatDate(latest) : undefined)}
          </p>
          <Link href={routes.aboutData} className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-10 px-0")}>
            <Info weight="bold" />
            {pl.common.menu.aboutData}
          </Link>
        </div>
        {osmEdit ? (
          <div className="mt-2">
            <a
              href={osmEdit}
              target="_blank"
              rel="noopener noreferrer"
              aria-describedby="osm-edit-hint"
              className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-10 px-0")}
            >
              {t.editOsm}
              <ArrowSquareOut aria-hidden />
            </a>
            <p id="osm-edit-hint" className="text-caption text-muted-foreground">
              {t.editOsmHint}
            </p>
          </div>
        ) : null}
      </section>

      <ReportDrawer
        open={drawer.open}
        onOpenChange={(open) => setDrawer((d) => ({ ...d, open }))}
        placeName={place.name}
        mode={drawer.mode}
        attribute={drawer.attribute}
        attributes={facts.map((f) => f.attribute)}
        formKey={drawer.key}
        onSubmit={submitReport}
      />
    </article>
  );
}

function PendingList({ entries }: { entries: PendingEntry[] }) {
  return (
    <div>
      <ul className="space-y-1.5">
        {entries.map((entry) => (
          <li
            key={entry.key}
            className="flex flex-wrap items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-caption ring-1 ring-primary/30"
          >
            <span className="font-semibold">{entry.kind === "report" ? t.mine.report : t.mine.confirmation}:</span>
            {entry.valueText ? <span>{entry.valueText}</span> : null}
            <ReliabilityBadge value="unverified" />
            <span className="text-muted-foreground tabular-nums">
              {formatDate(entry.createdAt)}
              {entry.sending ? ` · ${t.mine.sending}` : null}
            </span>
          </li>
        ))}
      </ul>
      {entries.some((e) => e.kind === "report") ? (
        <p className="mt-1 text-caption text-muted-foreground">{t.mine.pendingNote}</p>
      ) : null}
    </div>
  );
}
