import { Check, CheckCircle, ClockCounterClockwise, ExclamationMark, Minus, Prohibit, Question, SealCheck, SealQuestion, WarningDiamond, type Icon } from "@phosphor-icons/react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { Reliability, Status } from "@/lib/data"
import { pl } from "@/i18n/pl"

const STATUS_WORD = pl.status

export const STATUS_ICON: Record<Status, Icon> = {
  met: CheckCircle,
  barrier: Prohibit,
  conflict: WarningDiamond,
  unknown: Question,
}

const PIN_GLYPH: Record<Status, Icon> = { met: Check, barrier: Minus, conflict: ExclamationMark, unknown: Question }

export const statusText: Record<Status, string> = {
  met: "text-status-met",
  barrier: "text-status-barrier",
  conflict: "text-status-conflict",
  unknown: "text-status-unknown",
}

export function StatusIcon({ status, className }: { status: Status; className?: string }) {
  const I = STATUS_ICON[status]
  return <I aria-hidden weight={status === "unknown" ? "bold" : "fill"} className={cn("shrink-0", statusText[status], className)} />
}

export function SampleTag({ className }: { className?: string }) {
  return (
    <Badge variant="sample" aria-label={pl.app.sampleAria} className={className}>
      {pl.app.sampleTag}
    </Badge>
  )
}

export function StatusBadge({
  status,
  reason,
  unconfirmed,
  className,
}: {
  status: Status
  reason?: string
  unconfirmed?: boolean
  className?: string
}) {
  return (
    <Badge
      variant={status}
      className={cn("h-7 gap-1.5 rounded-full px-2.5 text-[13px] font-semibold [&>svg]:size-4!", className)}
    >
      <StatusIcon status={status} />
      <span>
        {STATUS_WORD[status]}
        {reason ? <span className="font-medium opacity-90"> · {reason}</span> : null}
        {unconfirmed ? <span className="font-medium opacity-75"> · {pl.unconfirmed}</span> : null}
      </span>
    </Badge>
  )
}

const bigVerdict = cva("flex items-center gap-3.5 rounded-[20px] p-4", {
  variants: {
    status: {
      met: "bg-status-met-bg",
      barrier: "bg-status-barrier-bg",
      conflict: "bg-status-conflict-bg",
      unknown: "border-[1.5px] border-dashed border-status-unknown/60 bg-status-unknown-bg",
    },
  },
})

export function VerdictBlock({ status, reason, sub, unconfirmed }: { status: Status; reason: string; sub: string; unconfirmed?: boolean }) {
  return (
    <div className={bigVerdict({ status })}>
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-card/80">
        <StatusIcon status={status} className="size-7" />
      </span>
      <div className="min-w-0">
        <p className={cn("text-title font-semibold", statusText[status])}>
          {STATUS_WORD[status]} · {reason}
        </p>
        {unconfirmed ? <p className="text-caption font-semibold text-foreground/70 uppercase tracking-[0.04em]">{pl.unconfirmed}</p> : null}
        <p className="text-body-sm text-foreground/75">{sub}</p>
      </div>
    </div>
  )
}

/** Pin glyph: circle (met), octagon (barrier), diamond (conflict), dashed circle (unknown). */
export function PinShape({ status, size = 36, selected = false }: { status: Status | null; size?: number; selected?: boolean }) {
  const r = size / 2
  const fill = status ? `var(--status-${status})` : "var(--primary)"
  const ring = selected ? (
    <circle r={r + 6} fill="none" stroke="var(--primary)" strokeWidth={3} />
  ) : null
  let shape
  if (status === "barrier") {
    const pts = Array.from({ length: 8 }, (_, i) => {
      const a = (Math.PI / 8) * (2 * i + 1)
      return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`
    }).join(" ")
    shape = <polygon points={pts} fill={fill} stroke="var(--card)" strokeWidth={2.5} strokeLinejoin="round" />
  } else if (status === "conflict") {
    const d = r * 1.08
    shape = (
      <rect x={-d * 0.72} y={-d * 0.72} width={d * 1.44} height={d * 1.44} rx={4} transform="rotate(45)" fill={fill} stroke="var(--card)" strokeWidth={2.5} />
    )
  } else if (status === "unknown") {
    shape = (
      <>
        <circle r={r} fill="var(--card)" />
        <circle r={r - 1.5} fill="var(--status-unknown-bg)" stroke="var(--status-unknown)" strokeWidth={1.75} strokeDasharray="4 3" />
      </>
    )
  } else {
    shape = <circle r={r} fill={fill} stroke="var(--card)" strokeWidth={2.5} />
  }
  const I = status ? PIN_GLYPH[status] : null
  const glyph = size * 0.5
  return (
    <g>
      {ring}
      <g style={{ filter: "drop-shadow(0 2px 3px rgb(22 20 31 / .18)) drop-shadow(0 6px 10px rgb(91 61 245 / .12))" }}>{shape}</g>
      {I ? (
        <g transform={`translate(${-glyph / 2},${-glyph / 2})`}>
          <I
            width={glyph}
            height={glyph}
            weight="bold"
            color={status === "unknown" ? "var(--status-unknown)" : "var(--card)"}
          />
        </g>
      ) : (
        <circle r={4} fill="var(--card)" />
      )}
    </g>
  )
}

const REL_ICON: Record<Reliability, Icon> = {
  confirmed: SealCheck,
  unverified: SealQuestion,
  outdated: ClockCounterClockwise,
  conflict: WarningDiamond,
  unknown: Question,
}
const REL_TONE: Record<Reliability, string> = {
  confirmed: "text-status-met",
  unverified: "text-foreground/70",
  outdated: "text-status-conflict",
  conflict: "text-status-conflict",
  unknown: "text-status-unknown",
}

export function ReliabilityChip({ value, className }: { value: Reliability; className?: string }) {
  const I = REL_ICON[value]
  return (
    <span className={cn("inline-flex items-center gap-1 text-caption font-semibold whitespace-nowrap", REL_TONE[value], className)}>
      <I weight={value === "confirmed" || value === "conflict" ? "fill" : "bold"} className="size-4 shrink-0" aria-hidden />
      {pl.reliability[value]}
    </span>
  )
}
