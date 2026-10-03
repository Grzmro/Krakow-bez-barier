import { ArrowCounterClockwise, Minus, Plus } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { VaulDrawer, VaulDrawerContent, VaulDrawerDescription, VaulDrawerTitle } from "@/components/ui/vaul-drawer"
import { ProfileSwitch } from "@/components/kbb/bits"
import { LabeledSwitch } from "@/screens/home"
import { pl } from "@/i18n/pl"
import type { Profile, Thresholds } from "@/lib/data"

function Stepper({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3">
      <span id={id} className="text-body-sm font-semibold">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex items-center gap-1 rounded-full bg-muted p-1">
        <Button type="button" variant="ghost" size="icon" className="size-10 bg-card" aria-label={`${pl.thresholds.dec}: ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
          <Minus weight="bold" />
        </Button>
        <output aria-live="polite" className="w-16 text-center font-display text-[17px] font-extrabold tabular-nums">
          {value} {pl.thresholds.cm}
        </output>
        <Button type="button" variant="ghost" size="icon" className="size-10 bg-card" aria-label={`${pl.thresholds.inc}: ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
          <Plus weight="bold" />
        </Button>
      </div>
    </div>
  )
}

export function ProfileSettingsDrawer({
  open,
  onOpenChange,
  container,
  profile,
  onProfile,
  value,
  onChange,
  onReset,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  container: HTMLElement | null
  profile: Profile
  onProfile: (p: Profile) => void
  value: Thresholds
  onChange: (t: Thresholds) => void
  onReset: () => void
}) {
  const set = <K extends keyof Thresholds>(k: K, v: Thresholds[K]) => onChange({ ...value, [k]: v })
  return (
    <VaulDrawer open={open} onOpenChange={onOpenChange} container={container}>
      <VaulDrawerContent aria-describedby="th-desc">
        <div className="overflow-y-auto px-4 pt-4 pb-5">
          <VaulDrawerTitle className="font-display text-h2 font-bold">{pl.thresholds.title}</VaulDrawerTitle>
          <VaulDrawerDescription id="th-desc" className="mt-1 text-body-sm text-muted-foreground">
            {pl.thresholds.proposal}
          </VaulDrawerDescription>
          <ProfileSwitch value={profile} onChange={(p) => p && onProfile(p)} size="sm" className="mt-4" />
          <div className="mt-3 divide-y divide-border">
            <Stepper id="th-max" label={pl.thresholds.maxThreshold} value={value.maxThreshold} min={0} max={10} step={1} onChange={(v) => set("maxThreshold", v)} />
            <Stepper id="th-door" label={pl.thresholds.minDoor} value={value.minDoor} min={60} max={120} step={5} onChange={(v) => set("minDoor", v)} />
            <LabeledSwitch id="th-steps" label={pl.thresholds.noSteps} checked={value.noSteps} onChange={(v) => set("noSteps", v)} />
            <LabeledSwitch id="th-elev" label={pl.thresholds.elevator} checked={value.elevator} onChange={(v) => set("elevator", v)} />
            <LabeledSwitch id="th-wc" label={pl.thresholds.toilet} checked={value.toilet} onChange={(v) => set("toilet", v)} />
            <LabeledSwitch id="th-surf" label={pl.thresholds.surface} checked={value.surface} onChange={(v) => set("surface", v)} />
            <LabeledSwitch id="th-chg" label={pl.thresholds.changing} checked={value.changing} onChange={(v) => set("changing", v)} />
          </div>
          <p className="mt-2 text-caption text-muted-foreground">{pl.thresholds.browserOnly}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={onReset}>
              <ArrowCounterClockwise weight="bold" />
              {pl.thresholds.reset}
            </Button>
            <Button size="lg" onClick={() => onOpenChange(false)}>
              {pl.thresholds.done}
            </Button>
          </div>
        </div>
      </VaulDrawerContent>
    </VaulDrawer>
  )
}
