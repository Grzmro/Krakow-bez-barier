import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Heart, ListBullets, MapTrifold, Moon, Sun, X } from "@phosphor-icons/react"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapView, type Camera, type MapPin } from "@/components/kbb/map-view"
import { BottomPanel, type Snap } from "@/components/kbb/bottom-panel"
import { LogoMark } from "@/components/kbb/bits"
import { useSize } from "@/hooks/use-size"
import { cn } from "@/lib/utils"
import { pl } from "@/i18n/pl"
import {
  DEFAULT_THRESHOLDS,
  PLACES,
  ROUTES,
  STATUS_SORT,
  TODAY,
  dateRank,
  factSummary,
  featureMatch,
  matchVerdict,
  type Evidence,
  type FeatureFilter,
  type FeatureKey,
  type Place,
  type Profile,
  type Route,
  type Status,
  type Thresholds,
} from "@/lib/data"
import { HomeSheet, HomeTop, MapControls, type CategoryFilter, type Row } from "@/screens/home"
import { PlaceBack, PlaceFront } from "@/screens/place"
import { CorrectionDrawer, OPTIONS } from "@/screens/correction"
import { ProfileSettingsDrawer } from "@/screens/profile-settings"
import { RouteSheet, RouteTop } from "@/screens/route"
import { BusinessPage } from "@/screens/widget"
import { SearchScreen, type SearchPick } from "@/screens/search"
import { A11yPage, AboutDataPage, MenuDrawer, ModeratorPage, PrivacyPage, SAMPLE_QUEUE, type PageId, type QueueItem } from "@/screens/pages"

type ScreenId = "home" | "place" | "route"
type Reports = Record<string, Partial<Record<FeatureKey, Evidence>>>
type Confirms = Record<string, Partial<Record<FeatureKey, number>>>

const TH_KEY = "kbb-proto-b-thresholds"
const readThresholds = (): Record<Profile, Thresholds> => {
  try {
    const raw = localStorage.getItem(TH_KEY)
    if (raw) return { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) }
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_THRESHOLDS
}

const HOME_CAM: Camera = { wx: 590, wy: 480, sx: 195, sy: 300, s: 0.56 }
const ROUTE_CAM: Camera = { wx: 728, wy: 392, sx: 195, sy: 292, s: 0.52 }

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const forced = document.documentElement.getAttribute("data-theme")
    if (forced === "dark" || forced === "light") return forced === "dark"
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  })
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const on = (e: MediaQueryListEvent) => setDark(e.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    document.documentElement.style.colorScheme = dark ? "dark" : "light"
  }, [dark])
  return [dark, setDark] as const
}

function withOverlays(p: Place, reports: Reports, confirms: Confirms): Place {
  const rep = reports[p.id]
  const conf = confirms[p.id]
  if (!rep && !conf) return p
  const facts = { ...p.facts }
  for (const [k, n] of Object.entries(conf ?? {}) as [FeatureKey, number][]) {
    const evs = [...(facts[k] ?? [])]
    if (!evs.length) continue
    let idx = 0
    evs.forEach((ev, i) => {
      if (dateRank(ev.date) > dateRank(evs[idx].date)) idx = i
    })
    evs[idx] = { ...evs[idx], confirmations: (evs[idx].confirmations ?? 0) + n, date: TODAY }
    facts[k] = evs
  }
  for (const [k, ev] of Object.entries(rep ?? {}) as [FeatureKey, Evidence][]) {
    facts[k] = [...(facts[k] ?? []), ev]
  }
  return { ...p, facts }
}

export default function App() {
  const [dark, setDark] = useDarkMode()
  const screenRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { height: H } = useSize(screenRef)
  const [screenEl, setScreenEl] = useState<HTMLDivElement | null>(null)

  const [screen, setScreen] = useState<ScreenId>("home")
  const [page, setPage] = useState<PageId | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profile, setProfileState] = useState<Profile | null>(null)
  const [thresholds, setThresholds] = useState<Record<Profile, Thresholds>>(readThresholds)
  const [placeId, setPlaceId] = useState("krzysztofory")
  const [flipped, setFlipped] = useState(false)
  const [openFact, setOpenFact] = useState<FeatureKey | null>(null)
  const [highlight, setHighlight] = useState<FeatureKey | null>(null)
  const [snap, setSnap] = useState<Snap>("half")
  const [routeSnap, setRouteSnap] = useState<Snap>("half")
  const [statusFilter, setStatusFilter] = useState<Status | null>(null)
  const [hideFailing, setHideFailing] = useState(false)
  const [filters, setFilters] = useState<FeatureFilter[]>([])
  const [showUnknown, setShowUnknown] = useState(false)
  const [category, setCategory] = useState<CategoryFilter>("all")
  const [searchOpen, setSearchOpen] = useState(false)
  const [corr, setCorr] = useState<{ open: boolean; fact: FeatureKey; preselect?: string }>({ open: false, fact: "toilet" })
  const [reports, setReports] = useState<Reports>({})
  const [confirms, setConfirms] = useState<Confirms>({})
  const [decisions, setDecisions] = useState<Record<string, QueueItem["state"]>>({})
  const [outage, setOutage] = useState(false)
  const [routeId, setRouteId] = useState<Route["id"]>("nostairs")
  const [routeSeg, setRouteSeg] = useState<number | null>(null)
  const [routeDest, setRouteDest] = useState<string | null>(null)
  const [announce, setAnnounce] = useState("")
  const [pinKey, setPinKey] = useState("p0")
  const [view, setView] = useState({ dx: 0, dy: 0, zoom: 1 })

  useEffect(() => {
    try {
      localStorage.setItem(TH_KEY, JSON.stringify(thresholds))
    } catch {
      /* storage unavailable */
    }
  }, [thresholds])

  // deep link: #miejsce-<id>
  useEffect(() => {
    const m = location.hash.match(/^#miejsce-([a-z-]+)$/)
    if (m && PLACES.some((p) => p.id === m[1])) {
      setPlaceId(m[1])
      setScreen("place")
    }
  }, [])

  const places = useMemo(() => PLACES.map((p) => withOverlays(p, reports, confirms)), [reports, confirms])
  const place = places.find((p) => p.id === placeId)!
  const th = profile ? thresholds[profile] : null
  const verdict = profile && th ? matchVerdict(place, profile, th) : null
  const route = ROUTES.find((r) => r.id === routeId)!
  const outageText = outage ? pl.home.outage("02.10.2026") : null

  const verdicts = useMemo(
    () => (profile && th ? Object.fromEntries(places.map((p) => [p.id, matchVerdict(p, profile, th)])) : {}),
    [profile, th, places],
  )
  const counts = useMemo(() => {
    const c: Record<Status, number> = { met: 0, barrier: 0, conflict: 0, unknown: 0 }
    Object.values(verdicts).forEach((v) => c[v.status]++)
    return c
  }, [verdicts])

  const categoryMatch = (p: Place) => category === "all" || p.category === category

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    for (const p of places) {
      if (!categoryMatch(p)) continue
      const v = profile ? verdicts[p.id] : null
      if (v) {
        if (statusFilter && v.status !== statusFilter) continue
        if (hideFailing && v.status === "barrier") continue
        out.push({ place: p, verdict: v, summary: factSummary(p), missing: false })
        continue
      }
      const m = filters.map((f) => featureMatch(p, f))
      if (m.includes("no")) continue
      const missing = m.includes("unknown")
      if (missing && !showUnknown) continue
      out.push({ place: p, verdict: null, summary: factSummary(p), missing })
    }
    return out.sort((a, b) => {
      if (a.verdict && b.verdict) {
        const d = STATUS_SORT.indexOf(a.verdict.status) - STATUS_SORT.indexOf(b.verdict.status)
        if (d) return d
      }
      if (a.missing !== b.missing) return a.missing ? 1 : -1
      return a.place.distance - b.place.distance
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, verdicts, profile, statusFilter, hideFailing, filters, showUnknown, category])

  useEffect(() => {
    const t = window.setTimeout(() => {
      setAnnounce(profile ? `${pl.profile.announce(profile, counts, rows.length)} ${pl.home.results(rows.length)}.` : `${pl.home.results(rows.length)}.`)
    }, 250)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, filters, showUnknown, category, statusFilter, hideFailing, thresholds])

  const setProfile = (p: Profile | null) => {
    if (p === profile) return
    setProfileState(p)
    setStatusFilter(null)
    setPinKey(`p${Date.now()}`)
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (screen === "place" && flipped) return
      screenRef.current?.querySelector<HTMLElement>("#screen-heading")?.focus({ preventScroll: true })
    }, 80)
    return () => window.clearTimeout(t)
  }, [screen, placeId, flipped, page])

  const openPlace = (id: string) => {
    setPlaceId(id)
    setFlipped(false)
    setOpenFact(null)
    setHighlight(null)
    setPage(null)
    setScreen("place")
  }
  const closePlace = () => {
    setScreen("home")
    setFlipped(false)
    setHighlight(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || corr.open || searchOpen || menuOpen || settingsOpen) return
      if (page) setPage(null)
      else if (screen === "place") closePlace()
      else if (screen === "route") setScreen("home")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const openCorrection = (fact: FeatureKey | null, preselect?: string) => {
    const target =
      fact ?? verdict?.needs.find((n) => n.status === "conflict")?.key ?? verdict?.needs.find((n) => n.status === "unknown")?.key ?? "door"
    setCorr({ open: true, fact: target, preselect })
  }

  const submitCorrection = (fact: FeatureKey, value: Evidence["value"], label: string, comment: string) => {
    const ev: Evidence = { value, label, source: "reports", level: "report", date: TODAY, mine: true, comment }
    const pid = placeId
    setReports((r) => ({ ...r, [pid]: { ...r[pid], [fact]: ev } }))
    setCorr((c) => ({ ...c, open: false }))
    setOpenFact(fact)
    setHighlight(fact)
    toast(pl.report.thanks, {
      icon: <Heart weight="fill" className="size-5 text-[#d6337a] dark:text-blush" />,
      duration: 5000,
      className: "kbb-thanks",
      action: {
        label: pl.report.undo,
        onClick: () =>
          setReports((r) => {
            const next = { ...r[pid] }
            delete next[fact]
            return { ...r, [pid]: next }
          }),
      },
    })
  }

  const confirmFact = (fact: FeatureKey) => {
    setConfirms((c) => ({ ...c, [placeId]: { ...c[placeId], [fact]: (c[placeId]?.[fact] ?? 0) + 1 } }))
    toast(pl.place.confirmed, { icon: <Heart weight="fill" className="size-5 text-[#d6337a] dark:text-blush" />, className: "kbb-thanks", duration: 3000 })
  }

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(okMsg, { duration: 2500 })
    } catch {
      toast(`${pl.app.copyFailed} ${text}`, { duration: 6000 })
    }
  }

  const soon = () => toast(pl.app.soon, { duration: 2500 })

  const goRoute = (dest: string | null) => {
    setRouteDest(dest)
    setRouteSeg(null)
    setRouteSnap("half")
    setFlipped(false)
    setPage(null)
    setScreen("route")
  }

  const onSearchPick = (p: SearchPick) => {
    setSearchOpen(false)
    if (p === "dworzec") goRoute(null)
    else if (p === "toilet") setCategory("toilet")
    else setView({ dx: 0, dy: 0, zoom: 1.3 })
  }

  const queue: QueueItem[] = useMemo(() => {
    const mine: QueueItem[] = []
    for (const [pid, facts] of Object.entries(reports)) {
      const p = PLACES.find((x) => x.id === pid)!
      for (const [k, ev] of Object.entries(facts) as [FeatureKey, Evidence][]) {
        const before = p.facts[k]?.map((e) => e.label).join(" / ") ?? pl.place.noValue
        mine.push({ id: `u-${pid}-${k}`, place: p.name, feature: pl.feature[k], before, after: ev.label, comment: ev.comment || undefined, date: TODAY, state: "pending" })
      }
    }
    return [...mine, ...SAMPLE_QUEUE].map((q) => ({ ...q, state: decisions[q.id] ?? q.state }))
  }, [reports, decisions])

  const jump = (n: number) => {
    setSearchOpen(false)
    setMenuOpen(false)
    setSettingsOpen(false)
    setCorr((c) => ({ ...c, open: false }))
    setPage(null)
    const toPlace = (flip: boolean) => {
      setProfile("wheelchair")
      setPlaceId("krzysztofory")
      setHighlight(null)
      setOpenFact(null)
      setScreen("place")
      setFlipped(flip)
    }
    switch (n) {
      case 1:
        setProfile(null)
        setFilters([])
        setShowUnknown(false)
        setCategory("all")
        setSnap("half")
        setScreen("home")
        break
      case 2:
        setProfile(null)
        setFilters(["noSteps", "toilet"])
        setShowUnknown(true)
        setCategory("all")
        setSnap("full")
        setScreen("home")
        break
      case 3:
        setProfile("wheelchair")
        setSnap("half")
        setScreen("home")
        break
      case 4:
        toPlace(false)
        break
      case 5:
        toPlace(true)
        break
      case 6:
        toPlace(false)
        window.setTimeout(() => setCorr({ open: true, fact: "door" }), 350)
        break
      case 7:
        setProfile("wheelchair")
        setScreen("home")
        window.setTimeout(() => setSettingsOpen(true), 200)
        break
      case 8:
        goRoute(null)
        break
      case 9:
        setOutage(true)
        setPage("about")
        break
      case 10:
        setPage("business")
        break
      case 11:
        setPage("moderator")
        break
      case 12:
        setPage("privacy")
        break
      case 13:
        setPage("a11y")
        break
    }
  }
  const activeJump = page
    ? { about: 9, business: 10, moderator: 11, privacy: 12, a11y: 13 }[page]
    : screen === "route"
      ? 8
      : screen === "place"
        ? corr.open
          ? 6
          : flipped
            ? 5
            : 4
        : settingsOpen
          ? 7
          : profile
            ? 3
            : filters.length
              ? 2
              : 1

  // ---- map ----
  const halfTop = Math.round(H * 0.5)
  const homeFullTop = 132
  const placeTop = 136
  const routeHalf = Math.round(H * 0.5)
  const routeFull = 196

  let camera: Camera = {
    ...HOME_CAM,
    wx: HOME_CAM.wx + view.dx,
    wy: HOME_CAM.wy + view.dy,
    s: HOME_CAM.s * view.zoom,
    sy: Math.round((130 + (snap === "full" ? homeFullTop + 120 : halfTop)) / 2) + 6,
  }
  if (screen === "place") camera = { wx: place.x, wy: place.y, sx: 195, sy: 76, s: 1.15 }
  if (screen === "route")
    camera = { ...ROUTE_CAM, sy: Math.round((186 + routeHalf) / 2), s: Math.min(0.6, Math.max(0.36, (routeHalf - 200) / 420)) }

  const pins: MapPin[] =
    screen === "route"
      ? []
      : (screen === "home" ? rows.map((r) => r.place) : places.filter(categoryMatch)).map((p) => {
          const v = profile ? verdicts[p.id] : null
          return {
            id: p.id,
            x: p.x,
            y: p.y,
            status: v?.status ?? null,
            selected: screen === "place" && p.id === placeId,
            dimmed: screen === "place" && p.id !== placeId,
            label: p.name,
          }
        })

  const routeSegs = route.segments.map((s, i, arr) => {
    const st = s.unknown ? "unknown" : s.stairs ? (profile === "stroller" && s.strollerRamp ? "met" : "barrier") : th && s.curbCm !== undefined && s.curbCm > th.maxThreshold ? "barrier" : "met"
    const seg = { id: s.id, points: s.points, status: st as Status }
    if (routeDest && i === arr.length - 1) {
      const pl2 = PLACES.find((p) => p.name === routeDest)
      if (pl2) seg.points = [...s.points.slice(0, -1), [pl2.x, pl2.y]]
    }
    return seg
  })
  const lastSeg = routeSegs[routeSegs.length - 1]
  const routeEnd = lastSeg.points[lastSeg.points.length - 1]

  const onMapKey = (e: React.KeyboardEvent) => {
    const step = 50
    const map: Record<string, () => void> = {
      ArrowLeft: () => setView((v) => ({ ...v, dx: v.dx - step })),
      ArrowRight: () => setView((v) => ({ ...v, dx: v.dx + step })),
      ArrowUp: () => setView((v) => ({ ...v, dy: v.dy - step })),
      ArrowDown: () => setView((v) => ({ ...v, dy: v.dy + step })),
      "+": () => zoom(1),
      "=": () => zoom(1),
      "-": () => zoom(-1),
    }
    if (map[e.key]) {
      e.preventDefault()
      map[e.key]()
    }
  }
  const zoom = (d: 1 | -1) => setView((v) => ({ ...v, zoom: Math.min(2.4, Math.max(0.6, +(v.zoom * (d > 0 ? 1.25 : 0.8)).toFixed(3))) }))

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center gap-12 bg-background max-[500px]:block min-[501px]:bg-[radial-gradient(1200px_600px_at_15%_10%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent),radial-gradient(900px_500px_at_90%_90%,color-mix(in_oklab,var(--blush)_22%,transparent),transparent)] min-[501px]:p-6">
      <aside className="hidden w-60 shrink-0 flex-col gap-4 min-[780px]:flex" aria-label={pl.shell.reviewerPanel}>
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <div>
            <p className="font-display text-title font-extrabold">{pl.app.name}</p>
            <p className="text-caption text-muted-foreground">{pl.shell.prototype}</p>
          </div>
        </div>
        <Badge className="h-7 w-fit rounded-full bg-ink px-3 text-[13px] font-semibold text-ink-foreground">{pl.shell.variant}</Badge>
        <nav aria-label={pl.shell.jumpNav} className="flex flex-col gap-0.5 rounded-[24px] bg-card/80 p-2 shadow-soft ring-1 ring-border backdrop-blur">
          {pl.shell.jumps.map((label, i) => {
            const n = i + 1
            return (
              <button
                key={n}
                type="button"
                onClick={() => jump(n)}
                aria-current={activeJump === n ? "step" : undefined}
                className={cn(
                  "press flex h-10 items-center gap-3 rounded-2xl px-2 text-left text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground",
                  activeJump === n && "bg-primary-container text-foreground",
                )}
              >
                <span className={cn("grid size-7 place-items-center rounded-full bg-muted font-display text-[12px] font-extrabold", activeJump === n && "bg-primary text-primary-foreground")}>
                  {n}
                </span>
                {label}
              </button>
            )
          })}
        </nav>
        <Button variant="outline" onClick={() => setDark(!dark)} className="w-fit">
          {dark ? <Sun /> : <Moon />}
          {dark ? pl.shell.light : pl.shell.dark}
        </Button>
        <p className="text-caption text-muted-foreground">{pl.shell.note}</p>
      </aside>

      <nav
        aria-label={pl.shell.jumpNav}
        className="fixed top-1/2 right-3 z-50 hidden max-h-[90dvh] -translate-y-1/2 flex-col gap-1 overflow-y-auto rounded-full bg-card/90 p-1.5 shadow-float ring-1 ring-border backdrop-blur min-[501px]:flex min-[780px]:hidden"
      >
        {pl.shell.jumps.map((label, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i + 1}. ${label}`}
            onClick={() => jump(i + 1)}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full font-display text-sm font-extrabold text-muted-foreground hover:bg-muted",
              activeJump === i + 1 && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <div
        className="relative shrink-0 rounded-[56px] bg-[#16141f] p-[10px] shadow-[0_30px_80px_-20px_rgba(22,20,31,.45),0_0_0_1px_rgba(255,255,255,.06)_inset] max-[500px]:fixed max-[500px]:inset-0 max-[500px]:h-auto! max-[500px]:w-auto! max-[500px]:rounded-none max-[500px]:p-0 max-[500px]:shadow-none"
        style={{ width: 410, height: "min(864px, calc(100dvh - 32px))" }}
      >
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[46px] bg-background max-[500px]:rounded-none">
          <p
            role="note"
            className="flex h-8 shrink-0 items-center justify-center gap-1.5 bg-ink pt-[env(safe-area-inset-top)] text-[11px] font-bold tracking-[0.08em] text-ink-foreground uppercase max-[500px]:h-auto max-[500px]:min-h-7"
          >
            <span className="size-1.5 rounded-full bg-blush" aria-hidden />
            {pl.app.sampleBanner}
          </p>
          <div
            ref={(el) => {
              screenRef.current = el
              if (el !== screenEl) setScreenEl(el)
            }}
            className="relative min-h-0 flex-1 overflow-hidden [transform:translateZ(0)]"
          >
            <div aria-live="polite" className="sr-only">
              {announce}
            </div>

            <div
              className="absolute inset-0 outline-none focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-ring"
              tabIndex={screen === "home" ? 0 : -1}
              role="group"
              aria-label={pl.home.mapLabel}
              onKeyDown={screen === "home" ? onMapKey : undefined}
            >
              <MapView
                camera={camera}
                pins={pins}
                pinKey={pinKey}
                onPinClick={screen === "home" ? openPlace : undefined}
                route={screen === "route" ? routeSegs : undefined}
                highlightSeg={routeSeg}
                routeStart={screen === "route" ? [905, 205] : undefined}
                routeEnd={screen === "route" ? routeEnd : undefined}
              />
            </div>

            {screen === "home" && (
              <>
                <h1 id="screen-heading" tabIndex={-1} className="sr-only">
                  {pl.home.heading}
                </h1>
                <HomeTop
                  category={category}
                  onCategory={setCategory}
                  onSearch={() => setSearchOpen(true)}
                  onMenu={() => setMenuOpen(true)}
                  onSkip={() => {
                    setSnap("full")
                    listRef.current?.focus()
                  }}
                />
                <MapControls top={snap === "full" ? homeFullTop + 112 : halfTop} onZoom={zoom} />
              </>
            )}

            {(screen === "home" || screen === "place") && (
              <BottomPanel
                label={screen === "place" ? place.name : pl.home.heading}
                snap={screen === "place" ? "full" : snap}
                onSnapChange={screen === "home" ? setSnap : undefined}
                halfTop={screen === "place" ? placeTop : halfTop}
                fullTop={screen === "place" ? placeTop : homeFullTop}
                headerRight={
                  screen === "place" ? (
                    <Button variant="secondary" size="icon" aria-label={pl.app.close} onClick={closePlace} className="size-10 bg-card/90 shadow-soft backdrop-blur">
                      <X weight="bold" />
                    </Button>
                  ) : null
                }
                className={screen === "place" ? "z-30" : undefined}
              >
                {screen === "home" ? (
                  <HomeSheet
                    profile={profile}
                    onProfile={setProfile}
                    onSettings={() => setSettingsOpen(true)}
                    counts={counts}
                    statusFilter={statusFilter}
                    onStatusFilter={setStatusFilter}
                    hideFailing={hideFailing}
                    onHideFailing={setHideFailing}
                    filters={filters}
                    onToggleFilter={(f) => setFilters((fs) => (fs.includes(f) ? fs.filter((x) => x !== f) : [...fs, f]))}
                    showUnknown={showUnknown}
                    onShowUnknown={setShowUnknown}
                    outage={outageText}
                    rows={rows}
                    onOpen={openPlace}
                    onClear={() => {
                      setFilters([])
                      setStatusFilter(null)
                      setHideFailing(false)
                      setCategory("all")
                    }}
                    listRef={listRef}
                    listKey={`${profile}-${statusFilter}-${category}-${filters.join()}-${showUnknown}`}
                  />
                ) : (
                  <div key={placeId} className="flip-scene screen-in absolute inset-0">
                    <div className="flip-inner relative h-full" data-flipped={flipped}>
                      <div className="flip-face flip-front absolute inset-0" inert={flipped}>
                        <PlaceFront
                          place={place}
                          verdict={verdict}
                          openFact={openFact}
                          onToggleFact={(f) => setOpenFact(openFact === f ? null : f)}
                          onWhy={() => {
                            setHighlight(null)
                            setFlipped(true)
                          }}
                          onRoute={() => goRoute(place.name)}
                          onReport={(f) => openCorrection(f)}
                          onConfirm={confirmFact}
                          onShare={() => copyText(`${location.href.split("#")[0]}#miejsce-${place.id}`, pl.place.shared)}
                          onAbout={() => setPage("about")}
                        />
                      </div>
                      <div className="flip-face flip-back absolute inset-0 bg-card" inert={!flipped}>
                        <PlaceBack
                          place={place}
                          verdict={verdict}
                          outage={outageText}
                          highlight={highlight}
                          active={flipped}
                          onFront={() => setFlipped(false)}
                          onFix={openCorrection}
                          onAbout={() => setPage("about")}
                          onAnswer={(fact, a) => {
                            const opts = OPTIONS[fact] ?? []
                            const pre = a === "no" ? opts.find((o) => o.value === false)?.id : opts[0]?.id
                            openCorrection(fact, pre)
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </BottomPanel>
            )}

            {screen === "home" && (
              <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center">
                <Button variant="ink" className="pointer-events-auto h-12 px-5" onClick={() => setSnap(snap === "full" ? "half" : "full")} aria-expanded={snap === "full"}>
                  {snap === "full" ? <MapTrifold weight="fill" /> : <ListBullets weight="bold" />}
                  {snap === "full" ? pl.home.map : pl.home.list}
                </Button>
              </div>
            )}

            {screen === "route" && (
              <>
                <RouteTop
                  destination={routeDest ?? pl.route.to}
                  routeId={routeId}
                  onRoute={(id) => {
                    setRouteId(id)
                    setRouteSeg(null)
                  }}
                  onBack={() => setScreen(routeDest ? "place" : "home")}
                  onSwap={soon}
                />
                <BottomPanel label={pl.route.segments} snap={routeSnap} onSnapChange={setRouteSnap} halfTop={routeHalf} fullTop={routeFull}>
                  <RouteSheet
                    route={route}
                    profile={profile}
                    thresholds={th}
                    onProfile={setProfile}
                    selected={routeSeg}
                    onSelect={setRouteSeg}
                    onSwitchRoute={(id) => {
                      setRouteId(id)
                      setRouteSeg(null)
                    }}
                    onFill={soon}
                    onGo={() => toast(pl.route.goSoon, { duration: 3000 })}
                  />
                </BottomPanel>
              </>
            )}

            {page === "about" && <AboutDataPage onBack={() => setPage(null)} outage={outage} onOutage={setOutage} />}
            {page === "privacy" && <PrivacyPage onBack={() => setPage(null)} />}
            {page === "a11y" && <A11yPage onBack={() => setPage(null)} />}
            {page === "moderator" && (
              <ModeratorPage onBack={() => setPage(null)} queue={queue} onDecide={(id, s) => setDecisions((d) => ({ ...d, [id]: s }))} />
            )}
            {page === "business" && (
              <BusinessPage
                initialProfile={profile}
                onBack={() => setPage(null)}
                onRoute={() => goRoute("Hotel Przykład")}
                onFullCard={() => openPlace("hotel")}
                onBook={() => toast(pl.business.bookMock, { duration: 2500 })}
                onCopied={() => toast(pl.app.copied, { duration: 2000 })}
                onCopyFail={() => toast(pl.app.copyFailed, { duration: 4000 })}
              />
            )}

            {searchOpen && <SearchScreen onClose={() => setSearchOpen(false)} onPick={onSearchPick} />}

            <MenuDrawer
              open={menuOpen}
              onOpenChange={setMenuOpen}
              container={screenEl}
              outage={outage}
              onOutage={setOutage}
              onNavigate={(p) => {
                setMenuOpen(false)
                setPage(p)
              }}
            />
            <CorrectionDrawer
              open={corr.open}
              onOpenChange={(o) => setCorr((c) => ({ ...c, open: o }))}
              container={screenEl}
              placeName={place.name}
              fact={corr.fact}
              preselect={corr.preselect}
              onSubmit={submitCorrection}
            />
            <ProfileSettingsDrawer
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              container={screenEl}
              profile={profile ?? "wheelchair"}
              onProfile={(p) => setProfile(p)}
              value={thresholds[profile ?? "wheelchair"]}
              onChange={(t) => setThresholds((all) => ({ ...all, [profile ?? "wheelchair"]: t }))}
              onReset={() => setThresholds((all) => ({ ...all, [profile ?? "wheelchair"]: DEFAULT_THRESHOLDS[profile ?? "wheelchair"] }))}
            />

            <Toaster
              position="bottom-center"
              offset={{ bottom: 96 }}
              mobileOffset={{ bottom: 96, left: 16, right: 16 }}
              toastOptions={{
                classNames: {
                  toast: "!rounded-[20px] !px-4 !py-3.5 !text-[15px] !font-semibold !shadow-float !gap-3",
                  actionButton: "!h-9 !rounded-full !px-3.5 !text-sm !font-semibold !bg-ink !text-ink-foreground",
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
