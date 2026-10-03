import { useState } from "react"
import { Bed, CaretRight, Copy, LockSimple, ShieldCheck, Star, Train } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogoMark, ProfileSwitch, SubPage } from "@/components/kbb/bits"
import { ReliabilityChip, SampleTag, StatusBadge } from "@/components/kbb/status"
import { pl } from "@/i18n/pl"
import { DEFAULT_THRESHOLDS, PLACES, SOURCE_SHORT, factState, factValueText, matchVerdict, type FeatureKey, type Profile } from "@/lib/data"

const HOTEL = PLACES.find((p) => p.id === "hotel")!
const WIDGET_FACTS: FeatureKey[] = ["entrance", "door", "toilet", "changing"]

const SNIPPET = `<div id="kbb-karta" data-miejsce="hotel-przyklad"></div>
<script src="https://cdn.przyklad.pl/kbb-widget.js"
        data-profil="auto" async></script>`

const API_SAMPLE = `GET /api/v1/miejsca/hotel-przyklad/cechy

{
  "miejsce": "Hotel Przykład",
  "cechy": [
    {
      "cecha": "szerokosc_drzwi",
      "wartosc": 90,
      "jednostka": "cm",
      "zrodlo": "Dane obiektu",
      "data": "2026-09-12",
      "status": "potwierdzone",
      "licencja": "CC BY 4.0"
    },
    {
      "cecha": "przewijak",
      "wartosc": null,
      "status": "brak_danych"
    }
  ],
  "atrybucja": "© OpenStreetMap contributors"
}`

async function copy(text: string, ok: () => void, fail: () => void) {
  try {
    await navigator.clipboard.writeText(text)
    ok()
  } catch {
    fail()
  }
}

function CodeBlock({ code, label, onCopied, onFail }: { code: string; label: string; onCopied: () => void; onFail: () => void }) {
  return (
    <div className="relative mt-3 overflow-hidden rounded-[20px] bg-ink text-ink-foreground">
      <pre tabIndex={0} aria-label={label} className="overflow-x-auto p-4 pr-14 font-mono text-[12px] leading-5 outline-none focus-visible:outline-3 focus-visible:outline-ring">
        {code}
      </pre>
      <Button
        variant="ghost"
        size="icon"
        aria-label={pl.business.copy}
        onClick={() => copy(code, onCopied, onFail)}
        className="absolute top-2 right-2 size-10 bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/20 hover:text-ink-foreground"
      >
        <Copy weight="bold" />
      </Button>
    </div>
  )
}

export function BusinessPage({
  initialProfile,
  onBack,
  onRoute,
  onFullCard,
  onBook,
  onCopied,
  onCopyFail,
}: {
  initialProfile: Profile | null
  onBack: () => void
  onRoute: () => void
  onFullCard: () => void
  onBook: () => void
  onCopied: () => void
  onCopyFail: () => void
}) {
  const [profile, setProfile] = useState<Profile>(initialProfile ?? "wheelchair")
  const v = matchVerdict(HOTEL, profile, DEFAULT_THRESHOLDS[profile])

  return (
    <SubPage title={pl.business.title} onBack={onBack} badge={<SampleTag />}>
      <Tabs defaultValue="widget" className="gap-0">
        <TabsList className="h-12! w-full rounded-full p-1">
          <TabsTrigger value="widget" className="h-10 rounded-full text-sm font-semibold">{pl.business.tabs.widget}</TabsTrigger>
          <TabsTrigger value="code" className="h-10 rounded-full text-sm font-semibold">{pl.business.tabs.code}</TabsTrigger>
          <TabsTrigger value="api" className="h-10 rounded-full text-sm font-semibold">{pl.business.tabs.api}</TabsTrigger>
        </TabsList>

        <TabsContent value="widget" className="mt-4">
          <div className="overflow-hidden rounded-[24px] bg-muted ring-1 ring-border">
            <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-3 text-caption text-muted-foreground">
                <LockSimple weight="fill" className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{HOTEL.www}</span>
              </div>
            </div>
            <div className="p-3 saturate-[.7]">
              <div aria-hidden className="relative h-[96px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#e9dcc8] via-[#f3e9dc] to-[#d9c6ad] dark:from-[#2b2533] dark:via-[#231f2b] dark:to-[#1d1925]">
                <Bed weight="duotone" className="absolute top-4 left-4 size-10 text-foreground/40" />
                <div className="absolute right-5 bottom-0 flex items-end gap-1.5 opacity-70">
                  <div className="h-14 w-10 rounded-t-md bg-card/70" />
                  <div className="h-20 w-12 rounded-t-md bg-card/80" />
                </div>
              </div>
              <p className="mt-3 font-display text-title font-bold">{HOTEL.name}</p>
              <p className="mt-0.5 flex items-center gap-2 text-caption text-muted-foreground">
                <span className="flex" aria-label={pl.business.stars}>
                  {[0, 1, 2].map((i) => (
                    <Star key={i} weight="fill" className="size-3.5 text-[#c9a227]" aria-hidden />
                  ))}
                </span>
                {pl.business.hotelRoom}
              </p>
            </div>

            <section aria-label={pl.business.availability} className="mx-3 rounded-[20px] bg-card p-4 shadow-float ring-1 ring-primary/25">
              <div className="flex items-center justify-between">
                <h2 className="text-title font-semibold">{pl.business.availability}</h2>
                <SampleTag />
              </div>
              <ProfileSwitch value={profile} onChange={(p) => p && setProfile(p)} size="sm" className="mt-3" />
              <div className="mt-3" aria-live="polite">
                <StatusBadge status={v.status} reason={v.reason} unconfirmed={v.status === "met" && v.unconfirmed} className="h-8 px-3 text-sm" />
              </div>
              <ul className="mt-3 space-y-1.5">
                {WIDGET_FACTS.map((k) => {
                  const s = factState(HOTEL, k)
                  return (
                    <li key={k} className="flex items-center justify-between gap-2 text-body-sm">
                      <span>
                        <span className="text-muted-foreground">{pl.feature[k]}:</span>{" "}
                        <span className="font-semibold">{factValueText(s) ?? pl.place.noValue}</span>
                      </span>
                      <ReliabilityChip value={s.reliability} />
                    </li>
                  )
                })}
              </ul>
              <p className="mt-3 flex items-center gap-1.5 text-caption text-muted-foreground">
                <ShieldCheck weight="fill" className="size-4 text-foreground/70" aria-hidden />
                {SOURCE_SHORT.owner} · {factState(HOTEL, "door").latest?.date}
              </p>
              <Separator className="my-3" />
              <button type="button" onClick={onRoute} className="press -mx-2 flex h-12 w-[calc(100%+16px)] items-center gap-3 rounded-2xl px-2 text-left hover:bg-muted">
                <span className="grid size-8 place-items-center rounded-full bg-ink text-ink-foreground">
                  <Train weight="bold" className="size-4" aria-hidden />
                </span>
                <span className="flex-1 text-body-sm font-semibold">
                  {pl.business.fromStation} <span className="font-display font-extrabold tabular-nums">12 min</span> · {pl.business.noStairs}
                </span>
                <CaretRight className="size-4 text-muted-foreground" aria-hidden />
              </button>
              <div className="mt-2 flex items-center justify-between gap-2">
                <button type="button" onClick={onFullCard} className="h-10 text-caption font-semibold text-primary underline-offset-4 hover:underline">
                  {pl.business.fullCard} ›
                </button>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                  <LogoMark className="size-4" />
                  {pl.app.name}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">© OpenStreetMap contributors</p>
            </section>
            <div className="p-3">
              <Button variant="ink" size="lg" className="w-full" aria-disabled onClick={onBook}>
                {pl.business.book}
              </Button>
            </div>
          </div>
          <div className="mt-5 rounded-[20px] border border-dashed border-border-strong/50 p-4">
            <p className="text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">{pl.business.forBusiness}</p>
            <p className="mt-2 text-body-sm">
              {pl.business.card} <span className="font-display font-extrabold tabular-nums">49 zł</span>
              {pl.business.perMonth}
            </p>
            <p className="mt-1 text-body-sm">
              {pl.business.audit} <span className="font-display font-extrabold tabular-nums">590 zł</span>
            </p>
          </div>
        </TabsContent>

        <TabsContent value="code" className="mt-4">
          <p className="text-body-sm text-foreground/85">{pl.business.codeLead}</p>
          <CodeBlock code={SNIPPET} label={pl.business.tabs.code} onCopied={onCopied} onFail={onCopyFail} />
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <p className="text-body-sm text-foreground/85">{pl.business.apiLead}</p>
          <p className="mt-4 text-caption font-semibold tracking-[0.06em] text-muted-foreground uppercase">{pl.business.apiEndpoint}</p>
          <CodeBlock code={API_SAMPLE} label={pl.business.tabs.api} onCopied={onCopied} onFail={onCopyFail} />
        </TabsContent>
      </Tabs>
    </SubPage>
  )
}
