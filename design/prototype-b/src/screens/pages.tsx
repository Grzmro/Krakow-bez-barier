import { useState } from "react"
import {
  PersonArmsSpread as Accessibility,
  CaretRight,
  CheckCircle,
  CloudSlash,
  Database,
  Info,
  LockKey,
  ShieldCheck,
  Storefront,
  Gavel,
  XCircle,
  Question,
  type Icon,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VaulDrawer, VaulDrawerContent, VaulDrawerTitle } from "@/components/ui/vaul-drawer"
import { SubPage } from "@/components/kbb/bits"
import { ReliabilityChip, SampleTag } from "@/components/kbb/status"
import { LabeledSwitch } from "@/screens/home"
import { cn } from "@/lib/utils"
import { pl } from "@/i18n/pl"
import { SOURCES, TODAY } from "@/lib/data"

export type PageId = "about" | "privacy" | "a11y" | "business" | "moderator"

export function MenuDrawer({
  open,
  onOpenChange,
  container,
  onNavigate,
  outage,
  onOutage,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  container: HTMLElement | null
  onNavigate: (p: PageId) => void
  outage: boolean
  onOutage: (v: boolean) => void
}) {
  const items: { id: PageId; icon: Icon; title: string; sub: string }[] = [
    { id: "about", icon: Database, title: pl.menu.aboutData, sub: pl.menu.aboutDataSub },
    { id: "business", icon: Storefront, title: pl.menu.business, sub: pl.menu.businessSub },
    { id: "moderator", icon: Gavel, title: pl.menu.moderator, sub: pl.menu.moderatorSub },
    { id: "privacy", icon: ShieldCheck, title: pl.menu.privacy, sub: pl.menu.privacySub },
    { id: "a11y", icon: Accessibility, title: pl.menu.a11y, sub: pl.menu.a11ySub },
  ]
  return (
    <VaulDrawer open={open} onOpenChange={onOpenChange} container={container}>
      <VaulDrawerContent aria-describedby={undefined}>
        <div className="overflow-y-auto px-3 pt-3 pb-5">
          <VaulDrawerTitle className="px-1 font-display text-h2 font-bold">{pl.menu.title}</VaulDrawerTitle>
          <ul className="mt-3 space-y-1">
            {items.map((it) => {
              const I = it.icon
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(it.id)}
                    className="press flex min-h-16 w-full items-center gap-3.5 rounded-2xl px-2 text-left hover:bg-muted"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-container text-primary">
                      <I weight="duotone" className="size-[22px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-semibold">{it.title}</span>
                      <span className="block text-caption text-muted-foreground">{it.sub}</span>
                    </span>
                    <CaretRight className="size-4 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="mx-2 mt-3 rounded-2xl border border-dashed border-status-conflict/50 px-3 py-1">
            <LabeledSwitch id="menu-outage" label={pl.menu.outage} checked={outage} onChange={onOutage} />
            <p className="-mt-1 pb-2 text-caption text-muted-foreground">{pl.menu.outageSub}</p>
          </div>
        </div>
      </VaulDrawerContent>
    </VaulDrawer>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

export function AboutDataPage({ onBack, outage, onOutage }: { onBack: () => void; outage: boolean; onOutage: (v: boolean) => void }) {
  return (
    <SubPage title={pl.about.title} onBack={onBack}>
      <p className="text-body text-foreground/85">{pl.about.lead}</p>
      <div className="mt-4 rounded-[20px] bg-card px-4 py-1 shadow-soft ring-1 ring-border/70">
        <LabeledSwitch id="about-outage" label={pl.about.outageSwitch} checked={outage} onChange={onOutage} />
        <p className="-mt-1 pb-3 text-caption text-muted-foreground">{pl.about.outageHint}</p>
      </div>
      <Section title={pl.about.sources}>
        <ul className="space-y-2.5">
          {SOURCES.map((s) => {
            const down = s.realOutage || (outage && s.id === "osm")
            return (
              <li key={s.id} className="rounded-[20px] bg-surface-raised p-4 shadow-soft ring-1 ring-border/70">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-body-sm font-semibold">{s.name}</p>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold",
                      down ? "bg-status-conflict-bg text-status-conflict" : "bg-status-met-bg text-status-met",
                    )}
                  >
                    {down ? <CloudSlash weight="bold" className="size-3.5" aria-hidden /> : <CheckCircle weight="fill" className="size-3.5" aria-hidden />}
                    {s.realOutage ? pl.about.statusReal404 : down ? pl.about.statusSim : pl.about.statusOk}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-caption">
                  <dt className="text-muted-foreground">{pl.about.license}</dt>
                  <dd>{s.license}</dd>
                  <dt className="text-muted-foreground">{pl.about.refresh}</dt>
                  <dd>{s.refresh}</dd>
                  <dt className="text-muted-foreground">{pl.about.verification}</dt>
                  <dd>{s.verification}</dd>
                  <dt className="text-muted-foreground">{pl.about.lastOk}</dt>
                  <dd className="tabular-nums">
                    {down && s.id === "osm" ? "02.10.2026 06:00" : s.lastUpdate} <SampleTag className="ml-1 align-middle" />
                  </dd>
                </dl>
              </li>
            )
          })}
        </ul>
      </Section>
      <Section title={pl.about.rulesTitle}>
        <ul className="divide-y divide-border rounded-[20px] bg-surface-raised ring-1 ring-border/70">
          {pl.about.rules.map(([k, v], i) => (
            <li key={k} className="flex flex-col gap-1 px-4 py-3">
              <ReliabilityChip value={(["confirmed", "unverified", "outdated", "conflict", "unknown"] as const)[i]} />
              <span className="text-caption text-muted-foreground">{v}</span>
            </li>
          ))}
        </ul>
      </Section>
      <p className="mt-6 flex items-center gap-2 text-caption text-muted-foreground">
        <Info weight="bold" className="size-4" aria-hidden />
        {pl.about.attribution}
      </p>
    </SubPage>
  )
}

function TextSections({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-2 space-y-2.5">
      {items.map(([t, b]) => (
        <section key={t} className="rounded-[20px] bg-surface-raised p-4 ring-1 ring-border/70">
          <h2 className="text-body font-semibold">{t}</h2>
          <p className="mt-1 text-body-sm text-foreground/80">{b}</p>
        </section>
      ))}
    </div>
  )
}

export function PrivacyPage({ onBack }: { onBack: () => void }) {
  return (
    <SubPage title={pl.privacy.title} onBack={onBack}>
      <p className="flex gap-3 rounded-[20px] bg-primary-container p-4 text-body font-semibold">
        <ShieldCheck weight="fill" className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
        {pl.privacy.lead}
      </p>
      <TextSections items={pl.privacy.sections} />
    </SubPage>
  )
}

function Bullets({ items, icon: I, tone }: { items: string[]; icon: Icon; tone: string }) {
  return (
    <ul className="space-y-2">
      {items.map((x) => (
        <li key={x} className="flex gap-2.5 text-body-sm">
          <I weight="fill" className={cn("mt-0.5 size-[18px] shrink-0", tone)} aria-hidden />
          {x}
        </li>
      ))}
    </ul>
  )
}

export function A11yPage({ onBack }: { onBack: () => void }) {
  return (
    <SubPage title={pl.a11y.title} onBack={onBack}>
      <p className="text-body text-foreground/85">{pl.a11y.lead}</p>
      <Section title={pl.a11y.works}>
        <Bullets items={pl.a11y.worksList} icon={CheckCircle} tone="text-status-met" />
      </Section>
      <Section title={pl.a11y.limits}>
        <Bullets items={pl.a11y.limitsList} icon={Question} tone="text-status-conflict" />
      </Section>
      <Section title={pl.a11y.plan}>
        <Bullets items={pl.a11y.planList} icon={CaretRight} tone="text-primary" />
      </Section>
      <p className="mt-6 text-caption text-muted-foreground">{pl.a11y.contact}</p>
    </SubPage>
  )
}

export interface QueueItem {
  id: string
  place: string
  feature: string
  before: string
  after: string
  comment?: string
  date: string
  state: "pending" | "approved" | "rejected" | "clarify"
}

export const SAMPLE_QUEUE: QueueItem[] = [
  { id: "q1", place: "Podziemia Rynku", feature: "Winda", before: "Jest · OSM 05.2026", after: "Nie działa", comment: "Kartka na drzwiach windy.", date: "01.10.2026", state: "pending" },
  { id: "q2", place: "Restauracja Przykład", feature: "Drzwi", before: "Brak danych", after: "85 cm", date: "30.09.2026", state: "pending" },
]

export function ModeratorPage({
  onBack,
  queue,
  onDecide,
}: {
  onBack: () => void
  queue: QueueItem[]
  onDecide: (id: string, s: QueueItem["state"]) => void
}) {
  const pending = queue.filter((q) => q.state === "pending")
  const done = queue.filter((q) => q.state !== "pending")
  const [sel, setSel] = useState<string | null>(pending[0]?.id ?? null)
  const cur = queue.find((q) => q.id === sel && q.state === "pending") ?? pending[0]
  return (
    <SubPage
      title={pl.moderator.title}
      onBack={onBack}
      badge={
        <Badge variant="outline" className="h-7 gap-1 rounded-full px-2.5 text-[12px] font-semibold">
          <LockKey weight="bold" className="size-3.5!" aria-hidden />
          {pl.moderator.mock}
        </Badge>
      }
    >
      <p className="flex items-center gap-2 text-caption text-muted-foreground">
        <LockKey weight="bold" className="size-4 shrink-0" aria-hidden />
        {pl.moderator.behindLogin}
      </p>
      <Section title={`${pl.moderator.queue} (${pending.length})`}>
        {pending.length ? (
          <ul className="space-y-2" role="listbox" aria-label={pl.moderator.queue}>
            {pending.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={cur?.id === q.id}
                  onClick={() => setSel(q.id)}
                  className={cn(
                    "press flex w-full items-center gap-3 rounded-2xl bg-surface-raised p-3 text-left ring-1 ring-border/70",
                    cur?.id === q.id && "ring-2 ring-primary",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-semibold">{q.place}</span>
                    <span className="block text-caption text-muted-foreground">
                      {q.feature} → {q.after} · {q.date}
                    </span>
                  </span>
                  <Badge variant="secondary" className="h-6 rounded-full px-2 text-[12px]">
                    {pl.moderator.state.pending}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-muted-foreground">{pl.moderator.empty}</p>
        )}
      </Section>
      {cur ? (
        <Section title={pl.moderator.preview}>
          <div className="rounded-[20px] bg-surface-raised p-4 shadow-soft ring-1 ring-border/70">
            <p className="text-body-sm font-semibold">
              {cur.place} · {cur.feature}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-muted p-3">
                <p className="text-caption text-muted-foreground">{pl.moderator.before}</p>
                <p className="mt-1 text-body-sm font-semibold">{cur.before}</p>
              </div>
              <div className="rounded-2xl bg-primary-container p-3">
                <p className="text-caption text-muted-foreground">{pl.moderator.after}</p>
                <p className="mt-1 text-body-sm font-semibold">{cur.after}</p>
                <ReliabilityChip value="confirmed" className="mt-1" />
              </div>
            </div>
            {cur.comment ? <p className="mt-3 text-caption text-foreground/80">„{cur.comment}”</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => onDecide(cur.id, "approved")} className="col-span-2">
                <CheckCircle weight="fill" />
                {pl.moderator.approve}
              </Button>
              <Button variant="outline" onClick={() => onDecide(cur.id, "rejected")}>
                <XCircle weight="bold" />
                {pl.moderator.reject}
              </Button>
              <Button variant="outline" onClick={() => onDecide(cur.id, "clarify")}>
                {pl.moderator.clarify}
              </Button>
            </div>
          </div>
        </Section>
      ) : null}
      <Section title={pl.moderator.history}>
        <ul className="divide-y divide-border rounded-[20px] bg-surface-raised ring-1 ring-border/70">
          {[...done, { id: "h0", place: "Sukiennice", feature: "Toaleta", before: "Brak danych", after: "dostosowana", date: "05.2026", state: "approved" as const }].map((q) => (
            <li key={q.id} className="flex items-center gap-3 px-4 py-3 text-caption">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">{q.place} · {q.feature}</span>
                <span className="text-muted-foreground">
                  {q.before} → {q.after} · {q.state === "approved" ? q.date : TODAY}
                </span>
              </span>
              <span className="font-semibold">{pl.moderator.state[q.state]}</span>
            </li>
          ))}
        </ul>
      </Section>
    </SubPage>
  )
}
