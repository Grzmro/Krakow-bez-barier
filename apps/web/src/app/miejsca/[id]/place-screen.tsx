"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  ArrowsHorizontal,
  Armchair,
  Baby,
  Building,
  Car,
  CheckCircle,
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
  Wheelchair,
  Wrench,
  type Icon,
} from "@phosphor-icons/react";
import type { AccessibilityAttribute, Outage, OutageEquipment, OutageVote, Place, PlaceSummary, Profile, Verdict } from "@krakow-bez-barier/contracts";
import { Button, buttonVariants, cn, toast, useAnnounce } from "@krakow-bez-barier/ui";
import { PlaceMap } from "@/components/home/place-map";
import { FactRow, ReliabilityBadge, SampleTag, VerdictBlock } from "@/components/kbb";
import { NeedGroups } from "@/components/profile/need-groups";
import { canReportOutage, isActiveOutage, isOutageEquipment } from "@/domain/outages";
import { useLocale, useMessages } from "@/i18n/client";
import { copyText } from "@/lib/copy-text";
import { usePlace } from "@/lib/places";
import { profileQuery } from "@/lib/profile/thresholds";
import { useProfile } from "@/lib/profile/use-profile";
import { useCategoryLookup } from "@/lib/categories";
import { CARD_ATTRIBUTES, factViews, failedSources, formatDate, latestSourceDate, osmEditUrl } from "@/lib/place-facts";
import { pendingEntries, withPending, type PendingEntry } from "@/lib/reports";
import { usePlaceOutages } from "@/lib/use-place-outages";
import { usePlaceReports } from "@/lib/use-place-reports";
import { routes } from "@/lib/routes";
import { useMediaQuery } from "@/lib/use-media-query";
import { OutageBanners } from "./outage-banners";
import { OutageConfirmDrawer } from "./outage-confirm-drawer";
import { ReportDrawer, type ReportMode, type ReportSubmission } from "./report-drawer";
import { TransitSection } from "./transit-section";

const DESKTOP = "(min-width: 64rem)";
const MAP_PADDING = { top: 40, bottom: 40 };
const noop = () => {};
const MINUTE_MS = 60_000;

const FACT_ICON: Partial<Record<AccessibilityAttribute, Icon>> = {
  wheelchair_overall: Wheelchair,
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
  const t = useMessages().place;
  const { settings } = useProfile();
  const query = usePlace(id, profileQuery(settings));

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
  return <PlaceCard place={query.data} profile={settings.profile} />;
}

function PlaceCard({ place, profile }: { place: Place; profile: Profile | null }) {
  const m = useMessages();
  const t = m.place;
  const locale = useLocale();
  const [contactOpen, setContactOpen] = useState(false);
  const focusContact = useRef(false);
  const contactRef = useRef<HTMLDivElement>(null);
  const announce = useAnnounce();
  const reports = usePlaceReports(place.id);
  // The row's first action button: "To się nie zgadza" / "Uzupełnij", or "Zmień" once this device sent something.
  const firstActions = useRef(new Map<AccessibilityAttribute, HTMLButtonElement>());
  const focusFirstAction = useRef<AccessibilityAttribute | null>(null);
  const outageApi = usePlaceOutages(place.id);
  const outages = useMemo(() => place.outages ?? [], [place.outages]);
  const outagesRef = useRef<HTMLElement>(null);
  const factsHeadingRef = useRef<HTMLHeadingElement>(null);
  const workingButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusOutages = useRef(false);
  const [now, setNow] = useState(() => new Date());
  const [openFacts, setOpenFacts] = useState<Partial<Record<AccessibilityAttribute, boolean>>>({});
  const [drawer, setDrawer] = useState<{ open: boolean; mode: ReportMode; attribute: AccessibilityAttribute; key: number }>({
    open: false,
    mode: "correct",
    attribute: CARD_ATTRIBUTES[0],
    key: 0,
  });
  const [outageConfirm, setOutageConfirm] = useState<{ open: boolean; equipment: OutageEquipment; unknown: boolean }>({
    open: false,
    equipment: "lift",
    unknown: false,
  });
  const facts = withPending(factViews(place, locale), pendingEntries(place, reports.entries, locale));
  const osmEdit = osmEditUrl(place);
  const failed = failedSources(place);
  const conflicts = facts.filter((f) => f.conflict);
  const firstUnknown = facts.find((f) => f.unknown && f.attribute !== "wheelchair_overall");
  const latest = latestSourceDate(place);
  const contact = place.contact;
  const hasContact = !!(contact?.phone || contact?.website || contact?.email);
  const desktop = useMediaQuery(DESKTOP);
  const mapPlaces = useMemo(() => [toSummary(place)], [place]);
  const sampleSources = useMemo(() => new Set(place.sources.filter((s) => s.isSample).map((s) => s.name)), [place]);
  const category = useCategoryLookup()(place.category);
  const CategoryIcon = category.icon;
  const address = [
    [place.address?.street, place.address?.houseNumber].filter(Boolean).join(" "),
    place.address?.city,
  ]
    .filter(Boolean)
    .join(", ");

  // Keeps "20 min temu" and the expiry current while the card stays open.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);

  // A new outage shows only after the card is refetched; focus follows to its banner then.
  useEffect(() => {
    if (!focusOutages.current || outages.length === 0) return;
    focusOutages.current = false;
    outagesRef.current?.focus();
  }, [outages]);

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
    focusFirstAction.current = attribute;
  };

  // The pressed button disappears when the row switches between "send" and "sent" actions; focus follows to the row's
  // first action once it has rendered.
  useEffect(() => {
    const attribute = focusFirstAction.current;
    const button = attribute ? firstActions.current.get(attribute) : undefined;
    if (!button) return;
    focusFirstAction.current = null;
    button.focus();
  });

  const confirmFact = async (attribute: AccessibilityAttribute, factId: string) => {
    if (await reports.confirm(attribute, factId)) focusFirstAction.current = attribute;
  };

  const withdraw = async (attribute: AccessibilityAttribute) => {
    if (await reports.withdraw(attribute)) focusFirstAction.current = attribute;
  };

  const firstActionRef = (attribute: AccessibilityAttribute) => (el: HTMLButtonElement | null) => {
    if (el) firstActions.current.set(attribute, el);
    else firstActions.current.delete(attribute);
  };

  const askOutage = (attribute: AccessibilityAttribute, unknown: boolean) => {
    if (isOutageEquipment(attribute)) setOutageConfirm({ open: true, equipment: attribute, unknown });
  };

  const reportOutage = async (equipment: OutageEquipment) => {
    setOutageConfirm((c) => ({ ...c, open: false }));
    focusOutages.current = true;
    const outage = await outageApi.report(equipment);
    if (!outage) focusOutages.current = false;
    setNow(new Date());
  };

  // The button pressed disappears; focus moves to the banner's other answer, or past the banners once it is gone.
  const voteOutage = async (outage: Outage, vote: OutageVote) => {
    const result = await outageApi.vote(outage.id, vote);
    setNow(new Date());
    if (!result) return;
    if (vote === "still_broken") workingButtons.current.get(outage.id)?.focus();
    else if (isActiveOutage(result) || outages.length > 1) outagesRef.current?.focus();
    else factsHeadingRef.current?.focus();
  };

  const share = async () => {
    const url = new URL(routes.place(place.id), window.location.origin).toString();
    const message = (await copyText(url)) ? t.shared : t.shareFailed;
    toast(message, { description: url });
    announce(message);
  };

  return (
    <article aria-labelledby="place-name" className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-x-8">
      <div className="lg:col-span-2 lg:flex lg:items-start lg:gap-6">
        <div className="relative grid h-[132px] place-items-center overflow-hidden rounded-[20px] bg-primary-container lg:size-32 lg:shrink-0">
          <span aria-hidden className="grid size-14 place-items-center rounded-full bg-card text-primary shadow-float">
            <CategoryIcon weight="duotone" className="size-7" />
          </span>
          <span className="absolute bottom-3 left-3 rounded-full bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground lg:hidden">
            {t.noPhoto}
          </span>
          {place.isSample ? <SampleTag className="absolute right-3 bottom-3 lg:right-auto lg:left-1/2 lg:-translate-x-1/2" /> : null}
        </div>

        <div className="lg:min-w-0 lg:flex-1">
          <h1 id="place-name" className="mt-4 font-display text-h1 font-bold lg:mt-0">
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
      </div>
      </div>

      <div className="lg:col-span-2">
        <OutageBanners
          ref={outagesRef}
          outages={outages}
          now={now}
          hasVoted={outageApi.hasVoted}
          onVote={voteOutage}
          workingRef={(id, element) => {
            if (element) workingButtons.current.set(id, element);
            else workingButtons.current.delete(id);
          }}
        />
        {failed.map((source) => (
          <div key={source.id} className="mt-5 flex gap-3 rounded-2xl bg-status-conflict-bg p-4">
            <CloudSlash weight="bold" className="mt-0.5 size-6 shrink-0 text-status-conflict" aria-hidden />
            <div>
              <p className="text-body-sm font-semibold text-status-conflict">
                {source.lastSuccessAt ? t.outage.title(formatDate(source.lastSuccessAt, locale)) : t.outage.titleNoDate}
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
              <table className="mt-3 hidden w-full max-w-3xl border-collapse text-left text-caption lg:table">
                <caption className="sr-only">{t.conflict.table.caption}</caption>
                <thead>
                  <tr className="border-b border-foreground/20">
                    <th scope="col" className="py-1.5 pr-4 font-semibold">{t.conflict.table.attribute}</th>
                    <th scope="col" className="py-1.5 pr-4 font-semibold">{t.conflict.table.source}</th>
                    <th scope="col" className="py-1.5 pr-4 font-semibold">{t.conflict.table.value}</th>
                    <th scope="col" className="py-1.5 font-semibold">{t.conflict.table.date}</th>
                  </tr>
                </thead>
                {conflicts.map((fact) => (
                  <tbody key={fact.attribute} className="border-b border-foreground/10 last:border-0">
                    {fact.sources.map((source, index) => (
                      <tr key={`${source.name}-${index}`}>
                        {index === 0 ? (
                          <th scope="rowgroup" rowSpan={fact.sources.length} className="py-1.5 pr-4 align-top font-semibold">
                            {fact.label}
                          </th>
                        ) : null}
                        <td className="py-1.5 pr-4 break-words">
                          <span className="flex flex-wrap items-center gap-x-2">
                            {source.name}
                            {sampleSources.has(source.name) ? <SampleTag /> : null}
                          </span>
                          {source.detail ? <span className="block text-muted-foreground">{source.detail}</span> : null}
                        </td>
                        <td className="py-1.5 pr-4 font-semibold break-words">{source.value}</td>
                        <td className="py-1.5 tabular-nums">
                          {source.date}
                          {source.staleNote ? <span className="block text-muted-foreground">{source.staleNote}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        ) : null}
      </div>

      <div className="lg:col-start-1">
        {profile && place.verdict ? <ProfileVerdict verdict={place.verdict} profile={profile} /> : null}
        <section aria-labelledby="place-facts">
          <h2 id="place-facts" ref={factsHeadingRef} tabIndex={-1} className="mt-6 mb-1 text-title font-semibold">
            {t.facts}
          </h2>
          <p className="mb-3 text-caption text-muted-foreground">{t.factsHint}</p>
          <ul className="divide-y divide-border overflow-hidden rounded-[20px] bg-surface-raised shadow-soft ring-1 ring-border">
            {facts.map((fact) => {
              const I = FACT_ICON[fact.attribute];
              const mine = fact.pending.find((p) => p.mine);
              const confirmId = fact.confirmFactId;
              const outageButton =
                canReportOutage(place, fact.attribute) && !outages.some((o) => o.equipment === fact.attribute) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t.breakdown.reportAria(fact.attribute)}
                    onClick={() => askOutage(fact.attribute, fact.unknown)}
                  >
                    <Wrench weight="bold" />
                    {t.breakdown.report}
                  </Button>
                ) : null;
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
                    mine ? (
                      <>
                        <span className="flex min-h-10 items-center gap-1.5 text-body-sm font-semibold">
                          <CheckCircle weight="fill" className="size-4 shrink-0 text-primary" aria-hidden />
                          {mine.kind === "confirmation" ? t.mine.sentConfirmation : t.mine.sentReport}
                        </span>
                        <Button
                          ref={firstActionRef(fact.attribute)}
                          variant="outline"
                          size="sm"
                          onClick={() => openReport(fact.unknown ? "fill" : "correct", fact.attribute)}
                        >
                          <PencilSimple weight="bold" />
                          {t.mine.change}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => withdraw(fact.attribute)}
                        >
                          <ArrowCounterClockwise weight="bold" />
                          {t.mine.withdraw}
                        </Button>
                        {outageButton}
                      </>
                    ) : fact.unknown ? (
                      <>
                        <Button
                          ref={firstActionRef(fact.attribute)}
                          variant="outline"
                          size="sm"
                          onClick={() => openReport("fill", fact.attribute)}
                        >
                          <Plus weight="bold" />
                          {t.fill}
                        </Button>
                        {outageButton}
                      </>
                    ) : (
                      <>
                        <Button
                          ref={firstActionRef(fact.attribute)}
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
                            onClick={() => confirmFact(fact.attribute, confirmId)}
                          >
                            <HandPalm weight="bold" />
                            {t.confirm}
                          </Button>
                        ) : null}
                        {outageButton}
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

        <TransitSection location={place.location.coordinates as [number, number]} />
      </div>

      <div
        className="lg:col-start-2 lg:space-y-4"
      >
        <section id="skad-wiemy" aria-labelledby="place-why" className="mt-8 scroll-mt-20 lg:mt-6">
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
                    {source.lastSuccessAt ? formatDate(source.lastSuccessAt, locale) : t.why.never}
                  </p>
                  {source.attribution ? <p className="mt-0.5 text-caption text-muted-foreground">{source.attribution}</p> : null}
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: "link", size: "sm" }),
                        "h-auto min-h-10 max-w-full shrink justify-start px-0 py-2 text-left whitespace-normal",
                      )}
                    >
                      <span className="min-w-0 break-all">{source.url.replace(/^https?:\/\//, "")}</span>
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
              {t.sourcesCount(place.sources.length, latest ? formatDate(latest, locale) : undefined)}
            </p>
            <Link href={routes.aboutData} className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-10 px-0")}>
              <Info weight="bold" />
              {m.common.menu.aboutData}
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
        <div className="hidden h-64 overflow-hidden rounded-[20px] ring-1 ring-border lg:block">
          {desktop ? (
            <PlaceMap places={mapPlaces} selectedId={place.id} onSelect={noop} padding={MAP_PADDING} label={t.mapLabel} />
          ) : null}
        </div>
      </div>

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
      <OutageConfirmDrawer
        open={outageConfirm.open}
        onOpenChange={(open) => setOutageConfirm((c) => ({ ...c, open }))}
        placeName={place.name}
        equipment={outageConfirm.equipment}
        unknown={outageConfirm.unknown}
        onConfirm={reportOutage}
      />
    </article>
  );
}

function ProfileVerdict({ verdict, profile }: { verdict: Verdict; profile: Profile }) {
  const m = useMessages();
  const t = m.place.profileVerdict;
  const needs = verdict.needs ?? [];
  const met = needs.filter((n) => n.state === "met").length;
  return (
    <section aria-labelledby="place-profile" className="mt-6">
      <h2 id="place-profile" className="mb-1 text-title font-semibold">
        {t.title(m.profile.name[profile])}
      </h2>
      <p className="mb-3 text-caption text-muted-foreground">{t.hint}</p>
      <VerdictBlock
        status={verdict.state}
        reason={verdict.state === "met" ? undefined : verdict.reasons[0]}
        unconfirmed={verdict.unconfirmed}
        sub={needs.length ? t.needsMet(met, needs.length) : undefined}
      />
      {needs.length ? (
        <NeedGroups verdict={verdict} headingLevel={3} className="mt-4 rounded-[20px] bg-surface-raised p-4 shadow-soft ring-1 ring-border" />
      ) : null}
    </section>
  );
}

function toSummary(place: Place): PlaceSummary {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    location: place.location,
    address: place.address,
    summary: [],
    verdict: null,
    isSample: place.isSample,
  };
}

function PendingList({ entries }: { entries: PendingEntry[] }) {
  const t = useMessages().place;
  const locale = useLocale();
  return (
    <div>
      <ul className="space-y-1.5">
        {entries.map((entry) => (
          <li
            key={entry.key}
            className="flex flex-wrap items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-caption ring-1 ring-primary/30"
          >
            <span className="font-semibold">
              {entry.kind === "confirmation" ? t.mine.confirmation : entry.mine ? t.mine.report : t.mine.otherReport}:
            </span>
            {entry.valueText ? <span>{entry.valueText}</span> : null}
            <ReliabilityBadge value="unverified" />
            <span className="text-muted-foreground tabular-nums">
              {formatDate(entry.createdAt, locale)}
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
