import { useEffect, useRef, useState } from "react"
import {
  ArrowSquareOut,
  ArrowsCounterClockwise,
  CaretDown,
  ClockCounterClockwise,
  CloudSlash,
  Database,
  Globe,
  HandPalm,
  Info,
  MapPin,
  NavigationArrow,
  PencilSimple,
  Phone,
  Plus,
  ShareNetwork,
} from "@phosphor-icons/react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapView } from "@/components/kbb/map-view"
import { CATEGORY_ICON, FACT_ICON, LEVEL_ICON } from "@/components/kbb/bits"
import { ReliabilityChip, SampleTag, StatusIcon, VerdictBlock, statusText } from "@/components/kbb/status"
import { cn } from "@/lib/utils"
import { pl } from "@/i18n/pl"
import {
  FACT_ORDER,
  SOURCE_SHORT,
  factState,
  factValueText,
  formatDistance,
  isOutdated,
  sourceSummary,
  type Evidence,
  type FeatureKey,
  type NeedResult,
  type Place,
  type Status,
  type Verdict,
} from "@/lib/data"

function Hero({ place }: { place: Place }) {
  const I = CATEGORY_ICON[place.category]
  return (
    <div className="relative h-[132px] overflow-hidden rounded-[20px] bg-primary-container">
      <div aria-hidden className="absolute inset-0 opacity-90">
        <MapView camera={{ wx: place.x, wy: place.y, sx: 195, sy: 72, s: 1.7 }} showLabels={false} animate={false} />
      </div>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-primary/25 via-primary/5 to-blush/30 mix-blend-multiply dark:mix-blend-screen" />
      <span aria-hidden className="absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-card text-primary shadow-float">
        <I weight="duotone" className="size-7" />
      </span>
      <span className="absolute bottom-3 left-3 rounded-full bg-card/85 px-2.5 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
        {pl.place.noPhoto}
      </span>
      <SampleTag className="absolute right-3 bottom-3 bg-card/85 backdrop-blur" />
    </div>
  )
}

function EvidenceLine({ ev }: { ev: Evidence }) {
  const L = LEVEL_ICON[ev.level]
  const conf = ev.confirmations ?? 0
  return (
    <li className="flex flex-col gap-0.5 text-caption text-muted-foreground">
      <span className="flex flex-wrap items-center gap-x-1.5">
        <L weight="fill" className="size-4 text-foreground/70" aria-hidden />
        <span className="font-semibold text-foreground/85">{pl.place.source}: {SOURCE_SHORT[ev.source]}</span>
        <span aria-hidden>·</span>
        <span>{ev.label}</span>
      </span>
      <span className="pl-[22px] tabular-nums">
        {pl.place.acquired} {ev.date}
        {ev.level === "community" ? ` · ${conf >= 2 ? pl.place.communityConfirmed : pl.place.confirmations(conf)}` : ""}
      </span>
      {isOutdated(ev.date) ? (
        <span className="flex items-center gap-1 pl-[22px] font-semibold text-status-conflict">
          <ClockCounterClockwise className="size-3.5" aria-hidden />
          {pl.place.maybeOutdated(ev.date)}
        </span>
      ) : null}
    </li>
  )
}

export function FactRow({
  place,
  fk,
  need,
  open,
  onToggle,
  onReport,
  onConfirm,
}: {
  place: Place
  fk: FeatureKey
  need?: NeedResult
  open: boolean
  onToggle: () => void
  onReport: (f: FeatureKey) => void
  onConfirm: (f: FeatureKey) => void
}) {
  const s = factState(place, fk)
  const I = FACT_ICON[fk]
  const value = need ? need.value : (factValueText(s) ?? (s.reliability === "conflict" ? "?" : pl.place.noValue))
  const shown =
    value === "?" ? (s.reliability === "conflict" ? s.evidence.map((x) => x.label).join(" / ") : pl.place.noValue) : value
  const panelId = `fact-panel-${fk}`
  return (
    <li id={`fact-${fk}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={pl.place.factAria(pl.feature[fk], shown, pl.reliability[s.reliability], need ? pl.status[need.status] : undefined)}
        onClick={onToggle}
        className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:-outline-offset-3"
      >
        <I className="size-[22px] shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-body-sm font-medium text-muted-foreground">{pl.feature[fk]}</span>
          <span className="block">
            <span className={cn("font-display text-[17px] font-extrabold tabular-nums", value === "?" && s.reliability !== "conflict" && "text-muted-foreground")}>{shown}</span>
            {need?.limit ? <span className="ml-1.5 text-caption text-muted-foreground">{pl.place.limit(need.limit)}</span> : null}
          </span>
        </span>
        <ReliabilityChip value={s.reliability} className="shrink-0 self-start pt-0.5" />
        <CaretDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id={panelId} className="screen-in space-y-3 bg-muted/50 px-4 pt-2 pb-4">
          {s.evidence.length ? (
            <ul className="space-y-2.5">
              {s.evidence.map((ev, i) => (
                <EvidenceLine key={i} ev={ev} />
              ))}
            </ul>
          ) : (
            <p className="text-caption text-muted-foreground">{pl.place.nobody}</p>
          )}
          {s.mine.map((ev, i) => (
            <p key={i} className="flex flex-wrap items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-caption ring-1 ring-primary/30">
              <span className="font-semibold">{pl.place.yourReport}:</span> {ev.label}
              <ReliabilityChip value="unverified" />
              <span className="text-muted-foreground tabular-nums">{ev.date}</span>
            </p>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onReport(fk)}>
              {s.evidence.length ? <PencilSimple weight="bold" /> : <Plus weight="bold" />}
              {s.evidence.length ? pl.place.notRight : pl.place.fill}
            </Button>
            {s.evidence.length && s.reliability !== "conflict" ? (
              <Button variant="outline" size="sm" onClick={() => onConfirm(fk)}>
                <HandPalm weight="bold" />
                {pl.place.confirm}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  )
}

const GROUPS: { key: string; statuses: Status[]; label: string }[] = [
  { key: "barrier", statuses: ["barrier"], label: pl.place.groups.barrier },
  { key: "met", statuses: ["met"], label: pl.place.groups.met },
  { key: "unknown", statuses: ["unknown", "conflict"], label: pl.place.groups.unknown },
]

export function PlaceFront({
  place,
  verdict,
  openFact,
  onToggleFact,
  onWhy,
  onRoute,
  onReport,
  onConfirm,
  onShare,
  onAbout,
}: {
  place: Place
  verdict: Verdict | null
  openFact: FeatureKey | null
  onToggleFact: (f: FeatureKey) => void
  onWhy: () => void
  onRoute: () => void
  onReport: (f: FeatureKey) => void
  onConfirm: (f: FeatureKey) => void
  onShare: () => void
  onAbout: () => void
}) {
  const src = sourceSummary(place)
  const [contact, setContact] = useState(false)
  const allFacts = FACT_ORDER.filter((k) => {
    if (k === "ramp") {
      const ent = factState(place, "entrance").value as { steps: number } | undefined
      return !!place.facts.ramp || (ent?.steps ?? 0) > 0
    }
    return true
  })
  const unknownAny = verdict
    ? verdict.needs.some((n) => n.status === "unknown" || n.status === "conflict")
    : allFacts.some((k) => factState(place, k).reliability === "unknown")
  const firstUnknown = verdict?.needs.find((n) => n.status === "unknown")?.key ?? allFacts.find((k) => factState(place, k).reliability === "unknown")
  const row = (fk: FeatureKey, need?: NeedResult) => (
    <FactRow key={fk} place={place} fk={fk} need={need} open={openFact === fk} onToggle={() => onToggleFact(fk)} onReport={onReport} onConfirm={onConfirm} />
  )

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-6">
        <Hero place={place} />
        <h2 id="screen-heading" tabIndex={-1} className="mt-4 font-display text-h1 font-bold outline-none">
          {verdict ? <span className="sr-only">{pl.status[verdict.status]}. {pl.place.needsMet(verdict.met, verdict.total)}. </span> : null}
          {place.name}
        </h2>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {pl.categoryName[place.category]} · {place.address} · {formatDistance(place.distance)}
        </p>
        <p className="mt-3 flex gap-2 text-body-sm">
          <MapPin weight="fill" className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden />
          <span>
            <span className="sr-only">{pl.place.location}: </span>
            {place.entranceHint}
          </span>
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={onShare}>
            <ShareNetwork weight="bold" />
            {pl.place.share}
          </Button>
          {place.phone || place.www ? (
            <Button variant="outline" size="sm" aria-expanded={contact} onClick={() => setContact(!contact)}>
              <Phone weight="bold" />
              {pl.place.contact}
            </Button>
          ) : null}
        </div>
        {contact ? <ContactCard place={place} /> : null}

        {verdict ? (
          <>
            <div className="mt-5">
              <VerdictBlock
                status={verdict.status}
                reason={verdict.reason}
                unconfirmed={verdict.status === "met" && verdict.unconfirmed}
                sub={pl.place.needsMet(verdict.met, verdict.total)}
              />
            </div>
            {GROUPS.map((g) => {
              const needs = verdict.needs.filter((n) => g.statuses.includes(n.status))
              if (!needs.length) return null
              return (
                <section key={g.key} aria-label={g.label}>
                  <h3 className="mt-6 mb-2 flex items-center gap-2 text-title font-semibold">
                    <StatusIcon status={g.statuses[0]} className="size-5" />
                    {g.label}
                    <span className="font-num text-[15px] text-muted-foreground">{needs.length}</span>
                  </h3>
                  <ul className="divide-y divide-border overflow-hidden rounded-[20px] bg-surface-raised shadow-soft ring-1 ring-border/70">
                    {needs.map((n) => row(n.key, n))}
                  </ul>
                </section>
              )
            })}
          </>
        ) : (
          <>
            <h3 className="mt-6 mb-2 text-title font-semibold">{pl.place.facts}</h3>
            <ul className="divide-y divide-border overflow-hidden rounded-[20px] bg-surface-raised shadow-soft ring-1 ring-border/70">
              {allFacts.map((k) => row(k))}
            </ul>
            <p className="mt-2 text-caption text-muted-foreground">{pl.place.noProfileHint}</p>
          </>
        )}

        {unknownAny ? (
          <div className="mt-5 rounded-[20px] border border-dashed border-status-unknown/50 bg-status-unknown-bg/60 p-4">
            <p className="text-body-sm font-semibold">{pl.place.contactHint}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {firstUnknown ? (
                <Button size="sm" onClick={() => onReport(firstUnknown)}>
                  <Plus weight="bold" />
                  {pl.place.fill}
                </Button>
              ) : null}
              {(place.phone || place.www) && !contact ? (
                <Button variant="outline" size="sm" onClick={() => setContact(true)}>
                  <Phone weight="bold" />
                  {pl.place.contact}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-caption text-muted-foreground">
            <Database className="size-4" aria-hidden />
            {pl.place.sources(src.count, src.latest)}
          </p>
          <Button variant="link" size="sm" onClick={onAbout} className="h-10 px-0">
            <Info weight="bold" />
            {pl.place.aboutData}
          </Button>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-card/95 px-4 pt-3 pb-4 backdrop-blur">
        <Button variant="outline" size="lg" onClick={onWhy}>
          <ArrowsCounterClockwise />
          {pl.place.why}
        </Button>
        <Button size="lg" onClick={onRoute}>
          <NavigationArrow weight="fill" />
          {pl.place.route}
        </Button>
      </div>
    </div>
  )
}

function ContactCard({ place }: { place: Place }) {
  return (
    <div className="screen-in mt-3 space-y-2 rounded-2xl bg-muted p-3">
      {place.phone ? (
        <p className="flex items-center gap-2 text-body-sm">
          <Phone weight="fill" className="size-4 text-primary" aria-hidden />
          <span className="text-muted-foreground">{pl.place.phone}:</span>
          <span className="font-semibold tabular-nums select-all">{place.phone}</span>
          <SampleTag className="ml-auto" />
        </p>
      ) : null}
      {place.www ? (
        <p className="flex items-center gap-2 text-body-sm">
          <Globe weight="fill" className="size-4 text-primary" aria-hidden />
          <span className="text-muted-foreground">{pl.place.www}:</span>
          <span className="font-semibold select-all">{place.www}</span>
        </p>
      ) : null}
    </div>
  )
}

function EvidenceCard({ ev }: { ev: Evidence }) {
  const L = LEVEL_ICON[ev.level]
  const old = isOutdated(ev.date)
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl bg-surface-raised p-3 ring-1 ring-border">
      <p className="text-body-sm leading-5 font-semibold">{ev.label}</p>
      <p className="flex items-center gap-1.5 text-caption font-medium text-foreground/80">
        <L weight="fill" className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{SOURCE_SHORT[ev.source]}</span>
      </p>
      <p className="text-caption text-muted-foreground tabular-nums">{ev.date}</p>
      <div className="flex flex-wrap gap-1">
        {old ? <ReliabilityChip value="outdated" /> : null}
        {ev.source === "ziw" ? (
          <Badge variant="outline" className="h-6 gap-1 rounded-full px-2 text-[12px] font-semibold text-foreground/80">
            <CloudSlash className="size-3.5!" aria-hidden />
            {pl.back.copy}
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

export function PlaceBack({
  place,
  verdict,
  outage,
  highlight,
  active,
  onFront,
  onFix,
  onAnswer,
  onAbout,
}: {
  place: Place
  verdict: Verdict | null
  outage: string | null
  highlight: FeatureKey | null
  active: boolean
  onFront: () => void
  onFix: (fact: FeatureKey | null) => void
  onAnswer: (fact: FeatureKey, answer: "yes" | "no") => void
  onAbout: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const realOffline = Object.values(place.facts).flat().some((e) => e?.source === "ziw")
  const keys = verdict ? verdict.needs.map((n) => n.key) : FACT_ORDER.filter((k) => place.facts[k]?.length)
  const facts = [...keys].sort((a, b) => FACT_ORDER.indexOf(a) - FACT_ORDER.indexOf(b))

  useEffect(() => {
    if (!active) return
    const t = window.setTimeout(() => {
      const sc = scroller.current
      if (highlight) {
        const el = document.getElementById(`back-${highlight}`)
        if (el && sc) sc.scrollTo({ top: Math.max(0, el.offsetTop - sc.clientHeight / 4), behavior: "smooth" })
        ;(el?.querySelector("[data-focus]") as HTMLElement | null)?.focus({ preventScroll: true })
      } else {
        sc?.scrollTo({ top: 0 })
        headingRef.current?.focus({ preventScroll: true })
      }
    }, 320)
    return () => window.clearTimeout(t)
  }, [active, highlight])

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-6">
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-h1 font-bold outline-none">
          {pl.back.title}
        </h2>
        <p className="mt-1 text-body-sm text-muted-foreground">{place.name}</p>

        {outage ? (
          <div role="status" className="mt-5 flex gap-3 rounded-2xl bg-status-conflict-bg p-4 text-status-conflict">
            <CloudSlash weight="bold" className="mt-0.5 size-6 shrink-0" aria-hidden />
            <div>
              <p className="text-body-sm font-semibold">{outage}</p>
              <p className="mt-0.5 text-caption text-foreground/70">{pl.back.simulated}</p>
            </div>
          </div>
        ) : null}
        {realOffline ? (
          <div className="mt-3 flex gap-3 rounded-2xl bg-status-conflict-bg p-4 text-status-conflict">
            <CloudSlash weight="bold" className="mt-0.5 size-6 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold">{pl.back.offline}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-body-sm text-foreground/80">
                {pl.back.copyFrom} <SampleTag />
              </p>
              <p className="mt-1 font-mono text-[12px] text-foreground/60">msip3.um.krakow.pl → 404</p>
            </div>
          </div>
        ) : null}

        <ul className="mt-3">
          {facts.map((fk) => {
            const s = factState(place, fk)
            const need = verdict?.needs.find((n) => n.key === fk)
            const I = FACT_ICON[fk]
            const isConflict = s.reliability === "conflict"
            const hl = highlight === fk
            const status: Status | null = need ? need.status : null
            return (
              <li
                key={fk}
                id={`back-${fk}`}
                className={cn("-mx-2 rounded-2xl border-b border-border px-2 py-4 transition-colors duration-700 last:border-0", hl && active && "bg-primary-container/70")}
                aria-label={
                  isConflict
                    ? pl.back.conflictAria(pl.feature[fk], s.evidence.map((e) => `${SOURCE_SHORT[e.source]}: ${e.label}, ${e.date}`).join(". "))
                    : undefined
                }
              >
                <div data-focus tabIndex={-1} className="flex items-center gap-3 rounded-lg outline-none focus-visible:outline-3">
                  <I className="size-[22px] shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-body font-semibold">{pl.feature[fk]}</span>
                  {!isConflict && s.value !== undefined ? (
                    <span className="truncate font-display text-[17px] font-extrabold tabular-nums">{factValueText(s)}</span>
                  ) : null}
                  <span className={cn("ml-auto flex items-center gap-1.5", status && statusText[status])}>
                    <ReliabilityChip value={s.reliability} />
                  </span>
                </div>
                {s.evidence.length === 0 ? (
                  <div className="mt-2 flex items-center justify-between gap-3 pl-[34px]">
                    <span className="text-body-sm text-muted-foreground">{pl.place.nobody}</span>
                    <Button variant="outline" size="sm" onClick={() => onFix(fk)}>
                      <Plus weight="bold" />
                      {pl.place.fill}
                    </Button>
                  </div>
                ) : isConflict ? (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {s.evidence.map((ev, i) => (
                        <EvidenceCard key={i} ev={ev} />
                      ))}
                    </div>
                    {s.mine.length === 0 ? (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="mr-auto text-body-sm font-semibold">{pl.back.beenHere}</span>
                        <Button variant="outline" onClick={() => onAnswer(fk, "yes")}>
                          {pl.back.yes}
                        </Button>
                        <Button variant="outline" onClick={() => onAnswer(fk, "no")}>
                          {pl.back.no}
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <ul className="mt-2 space-y-2 pl-[34px]">
                    {s.evidence.map((ev, i) => (
                      <EvidenceLine key={i} ev={ev} />
                    ))}
                  </ul>
                )}
                {s.mine.map((ev, i) => (
                  <p key={i} className="mt-2 ml-[34px] flex flex-wrap items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-caption ring-1 ring-primary/30">
                    <span className="font-semibold">{pl.place.yourReport}:</span> {ev.label}
                    <ReliabilityChip value="unverified" />
                    <span className="text-muted-foreground tabular-nums">{ev.date}</span>
                  </p>
                ))}
              </li>
            )
          })}
        </ul>

        <div className="mt-2 flex flex-wrap gap-x-5">
          <Button variant="link" onClick={onAbout} className="h-12 px-0 text-body-sm">
            <Info weight="bold" />
            {pl.place.aboutData}
          </Button>
          <a
            href="https://www.openstreetmap.org/edit"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "link" }), "h-12 px-0 text-body-sm")}
          >
            {pl.back.editOsm}
            <ArrowSquareOut />
          </a>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-card/95 px-4 pt-3 pb-4 backdrop-blur">
        <Button variant="outline" size="lg" onClick={onFront}>
          <ArrowsCounterClockwise />
          {pl.back.front}
        </Button>
        <Button size="lg" onClick={() => onFix(null)}>
          <PencilSimple weight="bold" />
          {pl.back.fix}
        </Button>
      </div>
    </div>
  )
}
