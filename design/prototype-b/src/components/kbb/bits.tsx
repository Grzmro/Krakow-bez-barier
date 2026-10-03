import {
  Armchair,
  ArrowsHorizontal,
  Baby,
  BabyCarriage,
  Bank,
  Bed,
  Car,
  ChatCircleDots,
  Church,
  Elevator,
  ForkKnife,
  GridFour,
  MaskHappy,
  ShieldCheck,
  ShoppingBag,
  Stairs,
  Toilet,
  TrendUp,
  UsersThree,
  Wheelchair,
  PersonSimpleWalk,
  type Icon,
} from "@phosphor-icons/react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { pl } from "@/i18n/pl"
import type { Category, FeatureKey, Level, Profile } from "@/lib/data"

export const CATEGORY_ICON: Record<Category, Icon> = {
  restaurant: ForkKnife,
  museum: Bank,
  toilet: Toilet,
  hotel: Bed,
  monument: Church,
  theatre: MaskHappy,
  shop: ShoppingBag,
}

export const FACT_ICON: Record<FeatureKey, Icon> = {
  entrance: Stairs,
  door: ArrowsHorizontal,
  ramp: TrendUp,
  elevator: Elevator,
  surface: GridFour,
  toilet: Toilet,
  rest: Armchair,
  parking: Car,
  changing: Baby,
}

export const LEVEL_ICON: Record<Level, Icon> = {
  official: ShieldCheck,
  community: UsersThree,
  report: ChatCircleDots,
}

export const PROFILE_ICON: Record<Profile, Icon> = {
  wheelchair: Wheelchair,
  stroller: BabyCarriage,
}

type ProfileValue = Profile | "off"

const ITEM =
  "min-w-0 flex-1 rounded-full! border-0 px-2 text-[14px] font-semibold text-muted-foreground transition-[background-color,color,box-shadow] duration-200 hover:bg-transparent hover:text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:shadow-soft data-pressed:bg-primary data-pressed:text-primary-foreground"

/** One-tap profile toggle. `allowOff` adds the "for everyone" segment (profile is optional). */
export function ProfileSwitch({
  value,
  onChange,
  allowOff = false,
  size = "md",
  iconsOnly = false,
  className,
}: {
  value: Profile | null
  onChange: (p: Profile | null) => void
  allowOff?: boolean
  size?: "sm" | "md"
  iconsOnly?: boolean
  className?: string
}) {
  const items: ProfileValue[] = allowOff ? ["off", "wheelchair", "stroller"] : ["wheelchair", "stroller"]
  const current: ProfileValue = value ?? "off"
  return (
    <ToggleGroup
      aria-label={pl.profile.label}
      value={[current]}
      onValueChange={(v) => {
        const next = v[0] as ProfileValue | undefined
        if (next) onChange(next === "off" ? null : next)
      }}
      spacing={0}
      className={cn("relative w-full gap-0 rounded-full bg-muted p-1 ring-1 ring-border", iconsOnly && "w-auto", className)}
    >
      {items.map((p) => {
        const I = p === "off" ? PersonSimpleWalk : PROFILE_ICON[p]
        const label = p === "off" ? pl.profile.off : p === "wheelchair" ? pl.profile.wheelchair : pl.profile.strollerShort
        const aria = p === "off" ? pl.profile.offAria : pl.profileName[p]
        return (
          <ToggleGroupItem
            key={p}
            value={p}
            aria-label={aria}
            className={cn(ITEM, size === "md" ? "h-12 gap-1" : "h-10 gap-1 text-[13px]", iconsOnly && "w-11 flex-none px-0")}
          >
            {p === "off" && !iconsOnly ? null : <I weight={current === p ? "fill" : "regular"} className="size-[18px]! shrink-0" />}
            {iconsOnly ? null : <span className="truncate">{label}</span>}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="10" fill="var(--primary)" />
      <path d="M9 21.5c3-6.5 7.5-10 14-11" stroke="var(--primary-foreground)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="9.5" cy="21.5" r="3" fill="var(--blush)" />
      <circle cx="23" cy="10.5" r="3" fill="var(--primary-foreground)" />
    </svg>
  )
}

/** Full-screen secondary page inside the phone (menu destinations). */
export function SubPage({
  title,
  onBack,
  children,
  badge,
}: {
  title: string
  onBack: () => void
  children: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <div className="screen-in absolute inset-0 z-40 flex flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={pl.app.back}
          className="press grid size-12 place-items-center rounded-full hover:bg-muted"
        >
          <svg viewBox="0 0 256 256" className="size-5" aria-hidden>
            <path d="M160 208 80 128l80-80" fill="none" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 id="screen-heading" tabIndex={-1} className="min-w-0 flex-1 truncate font-display text-h2 font-bold outline-none">
          {title}
        </h1>
        {badge}
      </div>
      <div id="tresc" className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-10">
        {children}
      </div>
    </div>
  )
}
