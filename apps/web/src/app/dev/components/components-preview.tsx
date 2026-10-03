"use client";

import { useState, type ReactNode } from "react";
import { ArrowsHorizontal, PencilSimple, Stairs, Toilet, TrendUp } from "@phosphor-icons/react";
import {
  Button,
  RELIABILITIES,
  STATUSES,
  VaulDrawer,
  VaulDrawerClose,
  VaulDrawerContent,
  VaulDrawerDescription,
  VaulDrawerTitle,
  VaulDrawerTrigger,
  toast,
  useAnnounce,
} from "@krakow-bez-barier/ui";
import {
  BottomPanel,
  FactRow,
  ReliabilityBadge,
  SampleBanner,
  SampleTag,
  StatusBadge,
  VerdictBlock,
} from "@/components/kbb";
import { pl } from "@/i18n/pl";

const t = pl.dev;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="font-heading text-h2 font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ComponentsPreview() {
  const [expanded, setExpanded] = useState(false);
  const [found, setFound] = useState(12);
  const announce = useAnnounce();
  const f = t.facts;

  return (
    <>
      <Section id="sec-buttons" title={t.sections.buttons}>
        <div className="flex flex-wrap gap-2">
          <Button>{t.buttons.primary}</Button>
          <Button variant="ink">{t.buttons.ink}</Button>
          <Button variant="outline">{t.buttons.outline}</Button>
          <Button variant="secondary">{t.buttons.secondary}</Button>
          <Button variant="ghost">{t.buttons.ghost}</Button>
          <Button size="lg">{t.buttons.large}</Button>
        </div>
      </Section>

      <Section id="sec-status" title={t.sections.status}>
        <ul className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <li key={s}>
              <StatusBadge status={s} reason={t.reason[s]} />
            </li>
          ))}
          {STATUSES.map((s) => (
            <li key={`${s}-sm`}>
              <StatusBadge status={s} size="sm" unconfirmed={s === "met"} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="sec-verdict" title={t.sections.verdict}>
        <div className="grid gap-2">
          {STATUSES.map((s) => (
            <VerdictBlock key={s} status={s} reason={t.reason[s]} sub={t.verdictSub} unconfirmed={s === "conflict"} />
          ))}
        </div>
      </Section>

      <Section id="sec-reliability" title={t.sections.reliability}>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {RELIABILITIES.map((r) => (
            <li key={r}>
              <ReliabilityBadge value={r} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="sec-sample" title={t.sections.sample}>
        <div className="space-y-2">
          <SampleBanner className="rounded-xl" />
          <SampleTag />
        </div>
      </Section>

      <Section id="sec-facts" title={t.sections.facts}>
        <div className="flex justify-end">
          <SampleTag />
        </div>
        <ul className="divide-y divide-border overflow-hidden rounded-(--radius-card) bg-card shadow-soft">
          <FactRow
            icon={<Stairs />}
            label={f.entrance}
            value={f.entranceValue}
            unit={f.unitCm}
            status="barrier"
            reliability="confirmed"
            sources={[{ name: f.sourceCity, date: "12.09.2026" }]}
            actions={
              <Button variant="outline" size="sm">
                <PencilSimple weight="bold" />
                {f.notRight}
              </Button>
            }
          />
          <FactRow
            icon={<ArrowsHorizontal />}
            label={f.door}
            value="90"
            unit={f.unitCm}
            limit={f.doorLimit}
            status="met"
            reliability="outdated"
            sources={[
              {
                name: f.sourceOsm,
                date: "4.05.2021",
                detail: f.confirmations,
                staleNote: pl.common.fact.maybeOutdated("4.05.2021"),
              },
            ]}
          />
          <FactRow
            icon={<Toilet />}
            label={f.toilet}
            value={f.toiletConflict}
            status="conflict"
            reliability="conflict"
            sources={[
              { name: f.sourceOsm, date: "30.08.2026", value: f.yes },
              { name: f.sourceReport, date: "28.09.2026", value: f.no },
            ]}
          />
          <FactRow
            icon={<TrendUp />}
            label={f.ramp}
            status="unknown"
            reliability="unknown"
            sources={[]}
          />
        </ul>
      </Section>

      <Section id="sec-panel" title={t.sections.panel}>
        <div className="relative h-96 overflow-hidden rounded-(--radius-card) bg-map-land">
          <p className="p-4 text-body-sm text-foreground">{t.panel.map}</p>
          <BottomPanel label={t.panel.label} expanded={expanded} onExpandedChange={setExpanded}>
            <ul className="divide-y divide-border px-4">
              {Array.from({ length: 8 }, (_, i) => (
                <li key={i} className="py-3 text-body">
                  {t.panel.item(i + 1)}
                </li>
              ))}
            </ul>
          </BottomPanel>
        </div>
      </Section>

      <Section id="sec-feedback" title={t.sections.feedback}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => toast(t.feedback.toastText)}>
            {t.feedback.toast}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              announce(t.feedback.announceText(found));
              setFound((n) => n + 1);
            }}
          >
            {t.feedback.announce}
          </Button>
        </div>
        <VaulDrawer>
          <VaulDrawerTrigger asChild>
            <Button variant="outline">{t.feedback.openDrawer}</Button>
          </VaulDrawerTrigger>
          <VaulDrawerContent>
            <div className="space-y-3 px-4 pt-3 pb-6">
              <VaulDrawerTitle className="font-display text-h2 font-bold">{t.feedback.drawerTitle}</VaulDrawerTitle>
              <VaulDrawerDescription className="text-body text-muted-foreground">
                {t.feedback.drawerBody}
              </VaulDrawerDescription>
              <VaulDrawerClose asChild>
                <Button variant="secondary">{pl.common.app.close}</Button>
              </VaulDrawerClose>
            </div>
          </VaulDrawerContent>
        </VaulDrawer>
      </Section>
    </>
  );
}
