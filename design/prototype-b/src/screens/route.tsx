import { ArrowsDownUp, CaretDown, CaretLeft, CaretRight, NavigationArrow, Plus, Train, WarningCircle } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { LEVEL_ICON, ProfileSwitch } from "@/components/kbb/bits"
import { SampleTag, StatusBadge, StatusIcon, statusText } from "@/components/kbb/status"
import { cn } from "@/lib/utils"
import { pl } from "@/i18n/pl"
import { ROUTES, routeSummary, type Profile, type Route, type Status, type Thresholds } from "@/lib/data"

const ROUTE_LABEL: Record<Route["id"], string> = { nostairs: pl.route.avoidStairs, shortest: pl.route.shortest }

export function RouteTop({
  destination,
  routeId,
  onRoute,
  onBack,
  onSwap,
}: {
  destination: string
  routeId: Route["id"]
  onRoute: (id: Route["id"]) => void
  onBack: () => void
  onSwap: () => void
}) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 px-4 pt-3">
      <div className="flex items-start gap-2">
        <Button variant="outline" size="icon" aria-label={pl.app.back} onClick={onBack} className="mt-1 shrink-0 border-0 shadow-float">
          <CaretLeft weight="bold" />
        </Button>
        <div className="relative min-w-0 flex-1 rounded-[20px] bg-card p-1 shadow-float">
          <div className="flex h-12 items-center gap-3 px-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-ink-foreground">
              <Train weight="bold" className="size-4" aria-hidden />
            </span>
            <span className="truncate text-body font-semibold">{pl.route.from}</span>
          </div>
          <div className="ml-[26px] h-px w-[calc(100%-80px)] bg-border" />
          <div className="flex h-12 items-center gap-3 px-3">
            <span className="grid size-7 shrink-0 place-items-center">
              <span className="size-3.5 rounded-full bg-primary ring-4 ring-primary/20" />
            </span>
            <span className="truncate pr-12 text-body font-semibold">{destination}</span>
          </div>
          <Button variant="secondary" size="icon" aria-label={pl.route.swap} aria-disabled onClick={onSwap} className="absolute top-1/2 right-2 size-10 -translate-y-1/2">
            <ArrowsDownUp weight="bold" />
          </Button>
        </div>
      </div>
      <ToggleGroup aria-label={pl.route.kind} value={[routeId]} onValueChange={(v) => v[0] && onRoute(v[0] as Route["id"])} className="mt-3 ml-14">
        {ROUTES.map((r) => (
          <ToggleGroupItem
            key={r.id}
            value={r.id}
            className="h-10 rounded-full! bg-card px-4 text-sm font-semibold shadow-soft ring-1 ring-border hover:bg-card aria-pressed:bg-primary-container aria-pressed:ring-2 aria-pressed:ring-primary/60 data-pressed:bg-primary-container"
          >
            {ROUTE_LABEL[r.id]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

const BAR: Record<Status, string> = {
  met: "bg-status-met",
  barrier: "bg-status-barrier",
  conflict: "bg-status-conflict",
  unknown: "stripes-unknown",
}

export function RouteSheet({
  route,
  profile,
  thresholds,
  onProfile,
  selected,
  onSelect,
  onSwitchRoute,
  onFill,
  onGo,
}: {
  route: Route
  profile: Profile | null
  thresholds: Thresholds | null
  onProfile: (p: Profile | null) => void
  selected: number | null
  onSelect: (id: number | null) => void
  onSwitchRoute: (id: Route["id"]) => void
  onFill: () => void
  onGo: () => void
}) {
  const sum = routeSummary(route, profile, thresholds)
  const alt = ROUTES.find((r) => r.id !== route.id)!
  const altSum = routeSummary(alt, profile, thresholds)
  const clean = sum.barriers.length === 0
  const noneOk = !clean && altSum.barriers.length > 0
  const barrierList = (s: typeof sum) => s.barriers.map((b) => b.note).join(", ")
  const segs = sum.segs

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 id="screen-heading" tabIndex={-1} className="outline-none">
            <span className="font-display text-h1 font-extrabold tabular-nums">{route.minutes} min</span>
            <span className="ml-2 text-title font-semibold text-muted-foreground">· {route.km}</span>
          </h1>
          <SampleTag className="mt-2" />
        </div>
        <ProfileSwitch value={profile} onChange={onProfile} allowOff size="sm" className="mt-3" />
        <p className="mt-1.5 text-caption text-muted-foreground">
          {profile ? pl.route.profileOn(pl.profileName[profile].toLowerCase()) : pl.route.profileOff}
        </p>

        <div
          role="status"
          className={cn(
            "mt-3 rounded-[20px] p-4",
            clean ? "bg-status-met-bg" : noneOk ? "bg-status-barrier-bg" : "bg-status-barrier-bg",
          )}
        >
          {clean ? (
            <>
              <p className="flex items-center gap-2 text-body font-semibold text-status-met">
                <StatusIcon status="met" className="size-5" />
                {pl.route.noKnown}
              </p>
              <p className="mt-1 flex items-center gap-2 pl-7 text-body-sm font-semibold text-status-unknown">
                {pl.route.unknownOn(sum.unknownCount, sum.unknownMeters)}
              </p>
            </>
          ) : noneOk ? (
            <>
              <p className="flex items-center gap-2 text-body font-semibold text-status-barrier">
                <WarningCircle weight="fill" className="size-5" aria-hidden />
                {pl.route.noneOk}
              </p>
              <p className="mt-1 pl-7 text-body-sm">
                {pl.route.alternative} <strong>{barrierList(sum)}</strong>
              </p>
              <p className="mt-0.5 pl-7 text-caption text-muted-foreground">{pl.route.unknownOn(sum.unknownCount, sum.unknownMeters)}</p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 text-body font-semibold text-status-barrier">
                <StatusIcon status="barrier" className="size-5" />
                {pl.route.hasBarriers(barrierList(sum))}
              </p>
              <p className="mt-0.5 pl-7 text-caption text-muted-foreground">{pl.route.unknownOn(sum.unknownCount, sum.unknownMeters)}</p>
            </>
          )}
        </div>

        <div className="mt-3 flex items-center gap-[3px]" role="group" aria-label={pl.route.segments}>
          {segs.map(({ seg, status }) => (
            <button
              key={seg.id}
              type="button"
              aria-label={`${seg.id}. ${seg.name}, ${seg.length} m, ${pl.status[status]}`}
              aria-pressed={selected === seg.id}
              onClick={() => onSelect(selected === seg.id ? null : seg.id)}
              className="relative flex h-12 items-center"
              style={{ flexGrow: seg.length, flexBasis: 0, minWidth: 18 }}
            >
              <span
                className={cn(
                  "h-3 w-full rounded-full transition-[height,opacity] duration-200",
                  BAR[status],
                  selected !== null && selected !== seg.id && "opacity-35",
                  selected === seg.id && "h-4",
                )}
              />
              {status === "barrier" ? (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2">
                  <StatusIcon status="barrier" className="size-5" />
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onSwitchRoute(alt.id)}
          className="press mt-3 flex w-full items-center gap-3 rounded-[20px] bg-surface-raised p-3.5 text-left shadow-soft ring-1 ring-border/70"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold">
              {ROUTE_LABEL[alt.id]} <span className="font-normal text-muted-foreground">· {alt.minutes} min</span>
            </span>
            <span className="mt-1.5 block">
              {altSum.barriers.length ? (
                <StatusBadge status="barrier" reason={barrierList(altSum)} />
              ) : (
                <StatusBadge status={altSum.unknownCount ? "unknown" : "met"} reason={pl.route.unknownOn(altSum.unknownCount, altSum.unknownMeters)} />
              )}
            </span>
          </span>
          <CaretRight className="size-5 text-muted-foreground" aria-hidden />
        </button>

        <h2 className="mt-7 mb-1 text-title font-semibold">{pl.route.steps}</h2>
        <ol aria-label={pl.route.stepsAria}>
          {segs.map(({ seg, status, note }, i) => {
            const open = selected === seg.id
            const last = i === segs.length - 1
            const L = LEVEL_ICON.community
            return (
              <li key={seg.id} className="relative flex gap-3">
                <div className="flex w-9 shrink-0 flex-col items-center pt-3">
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-full text-sm font-bold",
                      status === "met" && "bg-status-met-bg",
                      status === "barrier" && "bg-status-barrier-bg",
                      status === "unknown" && "border-[1.5px] border-dashed border-status-unknown bg-status-unknown-bg",
                    )}
                  >
                    <StatusIcon status={status} className="size-5" />
                  </span>
                  {!last ? (
                    <span aria-hidden className={cn("mt-1 w-0 flex-1 border-l-2", status === "unknown" ? "border-dashed border-status-unknown/60" : "border-primary/40")} />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pb-2">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-label={pl.route.segmentAria(i + 1, segs.length, seg.name, seg.length, `${pl.status[status]}: ${note}`)}
                    onClick={() => onSelect(open ? null : seg.id)}
                    className={cn("flex min-h-14 w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted", open && "bg-primary-container hover:bg-primary-container")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-semibold">{seg.step}</span>
                      <span className={cn("block text-body-sm", status === "met" ? "text-muted-foreground" : statusText[status])}>
                        {seg.name} · {note}
                      </span>
                    </span>
                    <span className="font-display text-[15px] font-extrabold text-muted-foreground tabular-nums">{seg.length} m</span>
                    <CaretDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
                  </button>
                  {open ? (
                    <div className="screen-in px-3 pt-1 pb-2">
                      {seg.source ? (
                        <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
                          <L weight="fill" className="size-4 text-foreground/70" aria-hidden />
                          <span className="font-semibold text-foreground/80">{pl.level.community}</span> · {seg.source}
                        </span>
                      ) : (
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-caption text-muted-foreground">{pl.place.nobody}</span>
                          <Button variant="outline" size="sm" onClick={onFill}>
                            <Plus weight="bold" />
                            {pl.place.fill}
                          </Button>
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
      <div className="shrink-0 border-t border-border bg-card/95 px-4 pt-3 pb-4 backdrop-blur">
        <Button size="lg" className="w-full" onClick={onGo}>
          <NavigationArrow weight="fill" />
          {pl.route.go}
        </Button>
      </div>
    </div>
  )
}
