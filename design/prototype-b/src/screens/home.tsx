import { CloudSlash, List, MagnifyingGlass, Minus, Plus, SlidersHorizontal } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CATEGORY_ICON, ProfileSwitch } from "@/components/kbb/bits"
import { SampleTag, StatusBadge, StatusIcon } from "@/components/kbb/status"
import { useCountUp } from "@/hooks/use-count-up"
import { cn } from "@/lib/utils"
import { pl } from "@/i18n/pl"
import { formatDistance, type FeatureFilter, type Place, type Profile, type Status, type Verdict } from "@/lib/data"

export type CategoryFilter = "all" | "restaurant" | "museum" | "toilet" | "hotel"
const CATS: CategoryFilter[] = ["all", "restaurant", "museum", "toilet", "hotel"]
export const FILTERS: FeatureFilter[] = ["noSteps", "elevator", "toilet", "rest", "parking", "changing"]

export function LabeledSwitch({
  id,
  label,
  checked,
  onChange,
  className,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  className?: string
}) {
  return (
    <label htmlFor={id} className={cn("flex min-h-12 cursor-pointer items-center justify-between gap-3 text-body-sm font-semibold", className)}>
      <span>{label}</span>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="data-[size=default]:h-7 data-[size=default]:w-12 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring [&_[data-slot=switch-thumb]]:size-6! [&_[data-slot=switch-thumb]]:data-checked:translate-x-[calc(100%-6px)]!"
      />
    </label>
  )
}

export function HomeTop({
  category,
  onCategory,
  onSearch,
  onMenu,
  onSkip,
}: {
  category: CategoryFilter
  onCategory: (c: CategoryFilter) => void
  onSearch: () => void
  onMenu: () => void
  onSkip: () => void
}) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 pt-3">
      <a
        href="#lista"
        onClick={(e) => {
          e.preventDefault()
          onSkip()
        }}
        className="sr-only z-50 rounded-full bg-ink px-4 py-2 font-semibold text-ink-foreground focus:not-sr-only focus:absolute focus:top-3 focus:left-4"
      >
        {pl.app.skipToContent}
      </a>
      <div className="flex gap-2 px-4">
        <button
          type="button"
          onClick={onSearch}
          className="press flex h-[52px] min-w-0 flex-1 items-center gap-3 rounded-full bg-card px-5 text-left text-body text-muted-foreground shadow-float"
        >
          <MagnifyingGlass className="size-[22px] text-foreground" aria-hidden />
          {pl.home.search}
        </button>
        <Button variant="outline" size="icon" aria-label={pl.home.menu} onClick={onMenu} className="size-[52px] border-0 shadow-float">
          <List weight="bold" />
        </Button>
      </div>
      <ToggleGroup
        aria-label={pl.home.categories}
        value={[category]}
        onValueChange={(v) => v[0] && onCategory(v[0] as CategoryFilter)}
        spacing={2}
        className="no-scrollbar mt-3 w-full overflow-x-auto px-4 pb-2"
      >
        {CATS.map((c) => (
          <ToggleGroupItem
            key={c}
            value={c}
            className="h-10 rounded-full! bg-card px-4 text-sm font-semibold text-foreground shadow-soft ring-1 ring-border hover:bg-card aria-pressed:bg-primary-container aria-pressed:ring-2 aria-pressed:ring-primary/60 data-pressed:bg-primary-container"
          >
            {pl.categories[c]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

export function MapControls({ top, onZoom }: { top: number; onZoom: (d: 1 | -1) => void }) {
  return (
    <div
      className="absolute inset-x-4 z-10 flex items-end justify-between transition-[top] duration-[420ms] ease-(--ease-out-soft)"
      style={{ top: top - 112 }}
    >
      <span className="mb-1 rounded-full bg-card/85 px-2.5 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
        {pl.home.mapHint} · {pl.home.attribution}
      </span>
      <div className="flex flex-col overflow-hidden rounded-full bg-card shadow-float">
        <button type="button" aria-label={pl.home.zoomIn} onClick={() => onZoom(1)} className="grid size-12 place-items-center hover:bg-muted">
          <Plus weight="bold" className="size-5" />
        </button>
        <span aria-hidden className="mx-3 h-px bg-border" />
        <button type="button" aria-label={pl.home.zoomOut} onClick={() => onZoom(-1)} className="grid size-12 place-items-center hover:bg-muted">
          <Minus weight="bold" className="size-5" />
        </button>
      </div>
    </div>
  )
}

function Counter({ status, count, pressed, onToggle }: { status: Status; count: number; pressed: boolean; onToggle: () => void }) {
  const shown = useCountUp(count)
  const ring: Record<Status, string> = {
    met: "aria-pressed:bg-status-met-bg aria-pressed:ring-status-met",
    barrier: "aria-pressed:bg-status-barrier-bg aria-pressed:ring-status-barrier",
    conflict: "aria-pressed:bg-status-conflict-bg aria-pressed:ring-status-conflict",
    unknown: "aria-pressed:bg-status-unknown-bg aria-pressed:ring-status-unknown",
  }
  return (
    <Toggle
      pressed={pressed}
      onPressedChange={onToggle}
      aria-label={pl.home.counterAria(count, pl.status[status], pressed)}
      className={cn("h-11 min-w-0 gap-1.5 rounded-full bg-card px-3 ring-1 ring-border hover:bg-muted aria-pressed:ring-2", ring[status])}
    >
      <StatusIcon status={status} className="size-5!" />
      <span className="font-num text-[17px] text-foreground">{shown}</span>
    </Toggle>
  )
}

export interface Row {
  place: Place
  verdict: Verdict | null
  summary: string
  missing: boolean
}

export function PlaceRow({ row, onOpen, index }: { row: Row; onOpen: () => void; index: number }) {
  const { place, verdict } = row
  const I = CATEGORY_ICON[place.category]
  const aria = pl.home.rowAria(
    verdict ? `${pl.status[verdict.status]}, ${verdict.reason}${verdict.unconfirmed && verdict.status === "met" ? `, ${pl.unconfirmed}` : ""}` : row.missing ? pl.status.unknown : null,
    place.name,
    place.address,
    row.summary,
    place.distance,
  )
  return (
    <li className="screen-in" style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={aria}
        className="press flex w-full items-center gap-3.5 rounded-[20px] bg-surface-raised p-3 pr-3.5 text-left shadow-soft ring-1 ring-border/70 hover:ring-primary/30"
      >
        <span className="grid size-[52px] shrink-0 place-items-center self-start rounded-2xl bg-primary-container text-primary">
          <I weight="duotone" className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          {verdict ? (
            <StatusBadge status={verdict.status} reason={verdict.reason} unconfirmed={verdict.status === "met" && verdict.unconfirmed} className="max-w-full" />
          ) : row.missing ? (
            <StatusBadge status="unknown" />
          ) : null}
          <span className={cn("block truncate text-[17px] leading-6 font-semibold", (verdict || row.missing) && "mt-1.5")}>{place.name}</span>
          <span className="block truncate text-caption text-muted-foreground">{place.address}</span>
          {!verdict ? <span className="mt-1 block text-caption leading-[18px] font-medium text-foreground/80">{row.summary}</span> : null}
        </span>
        <span className="flex shrink-0 flex-col items-end justify-between gap-2 self-stretch py-0.5">
          <SampleTag />
          <span className="text-body-sm font-medium text-muted-foreground tabular-nums">{formatDistance(place.distance)}</span>
        </span>
      </button>
    </li>
  )
}

export function HomeSheet({
  profile,
  onProfile,
  onSettings,
  counts,
  statusFilter,
  onStatusFilter,
  hideFailing,
  onHideFailing,
  filters,
  onToggleFilter,
  showUnknown,
  onShowUnknown,
  outage,
  rows,
  onOpen,
  onClear,
  listRef,
  listKey,
}: {
  profile: Profile | null
  onProfile: (p: Profile | null) => void
  onSettings: () => void
  counts: Record<Status, number>
  statusFilter: Status | null
  onStatusFilter: (s: Status | null) => void
  hideFailing: boolean
  onHideFailing: (v: boolean) => void
  filters: FeatureFilter[]
  onToggleFilter: (f: FeatureFilter) => void
  showUnknown: boolean
  onShowUnknown: (v: boolean) => void
  outage: string | null
  rows: Row[]
  onOpen: (id: string) => void
  onClear: () => void
  listRef: React.RefObject<HTMLDivElement | null>
  listKey: string
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 px-4 pt-1 pb-2">
        <div className="flex items-center gap-2">
          <ProfileSwitch value={profile} onChange={onProfile} allowOff className="min-w-0 flex-1" />
        </div>
        {outage ? (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-status-conflict-bg px-3 py-2 text-caption font-semibold text-status-conflict">
            <CloudSlash weight="bold" className="size-4 shrink-0" aria-hidden />
            {outage}
          </p>
        ) : null}
        {profile ? (
          <>
            <div className="flex items-center gap-2">
              {(["met", "conflict", "unknown", "barrier"] as Status[]).map((s) => (
                <Counter key={s} status={s} count={counts[s]} pressed={statusFilter === s} onToggle={() => onStatusFilter(statusFilter === s ? null : s)} />
              ))}
              <Button variant="outline" size="icon" aria-label={pl.profile.settings} onClick={onSettings} className="ml-auto size-11 shrink-0">
                <SlidersHorizontal weight="bold" />
              </Button>
            </div>
            <LabeledSwitch id="hide-failing" label={pl.home.hideFailing} checked={hideFailing} onChange={onHideFailing} className="-my-1" />
          </>
        ) : (
          <>
            <div role="group" aria-label={pl.home.filtersLabel} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
              {FILTERS.map((f) => (
                <Toggle
                  key={f}
                  pressed={filters.includes(f)}
                  onPressedChange={() => onToggleFilter(f)}
                  className="h-10 shrink-0 rounded-full bg-card px-3.5 text-sm font-semibold ring-1 ring-border hover:bg-muted aria-pressed:bg-primary-container aria-pressed:ring-2 aria-pressed:ring-primary/60"
                >
                  {pl.filters[f]}
                </Toggle>
              ))}
            </div>
            {filters.length ? (
              <LabeledSwitch id="show-unknown" label={pl.home.showUnknown} checked={showUnknown} onChange={onShowUnknown} className="-my-1" />
            ) : null}
          </>
        )}
      </div>
      <div ref={listRef} id="lista" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-28 outline-none">
        <h2 className="mb-2 flex items-center justify-between text-caption font-semibold text-muted-foreground">
          <span>{pl.home.results(rows.length)}</span>
          <SampleTag />
        </h2>
        {rows.length ? (
          <ul key={listKey} className="space-y-2.5">
            {rows.map((r, i) => (
              <PlaceRow key={r.place.id} row={r} index={i} onOpen={() => onOpen(r.place.id)} />
            ))}
          </ul>
        ) : (
          <div className="grid place-items-center gap-3 py-10 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-primary-container">
              <StatusIcon status="unknown" className="size-8" />
            </span>
            <p className="text-title font-semibold">{pl.home.empty}</p>
            <Button variant="outline" onClick={onClear}>
              {pl.home.clearFilters}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
