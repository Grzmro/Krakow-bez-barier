"use client";

import {
  CheckCircle,
  ClockCounterClockwise,
  Prohibit,
  Question,
  SealCheck,
  SealQuestion,
  WarningDiamond,
  type Icon,
} from "@phosphor-icons/react";
import { cva } from "class-variance-authority";
import { useState } from "react";
import { Badge } from "../components/badge";
import { cn } from "../cn";
import type { Reliability, Status } from "../types";

// Status is never conveyed by colour alone: every component pairs a distinct icon shape with a
// text label passed in by the app (all copy lives in the app's i18n module).

export const STATUS_ICON: Record<Status, Icon> = {
  met: CheckCircle,
  barrier: Prohibit,
  conflict: WarningDiamond,
  unknown: Question,
};

export const statusTextClass: Record<Status, string> = {
  met: "text-status-met",
  barrier: "text-status-barrier",
  conflict: "text-status-conflict",
  unknown: "text-status-unknown",
};

export function StatusIcon({ status, className }: { status: Status; className?: string }) {
  const I = STATUS_ICON[status];
  return (
    <I
      aria-hidden
      weight={status === "unknown" ? "bold" : "fill"}
      className={cn("shrink-0", statusTextClass[status], className)}
    />
  );
}

/** True once `value` has differed from its first value: a status that changes fades in, one that loads doesn't. */
export function useChanged<T>(value: T): boolean {
  const [seen, setSeen] = useState(value);
  const [changed, setChanged] = useState(false);
  if (!Object.is(seen, value)) {
    setSeen(value);
    setChanged(true);
  }
  return changed;
}

export interface StatusBadgeProps {
  status: Status;
  /** The status word, e.g. "Spełnia". */
  label: string;
  /** Short reason with a number, e.g. "3 stopnie". */
  reason?: string;
  /** Qualifier such as "niepotwierdzone". */
  note?: string;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({ status, label, reason, note, size = "md", className }: StatusBadgeProps) {
  const changed = useChanged(status);
  return (
    <Badge
      variant={status}
      data-status={status}
      className={cn(
        "h-auto max-w-full justify-start overflow-visible font-semibold whitespace-normal",
        size === "md"
          ? "min-h-7 gap-1.5 rounded-[14px] px-2.5 py-1 text-[13px] leading-[18px] [&>svg]:size-4!"
          : "min-h-6 gap-1 rounded-xl px-2 py-1 text-xs leading-4 [&>svg]:size-3.5!",
        className,
      )}
    >
      <StatusIcon key={status} status={status} className={cn("mt-px self-start", changed && "motion-fade")} />
      <span key={`${status}-label`} className={cn("min-w-0 [overflow-wrap:break-word]", changed && "motion-fade")}>
        {label}
        {reason ? <span className="font-medium"> · {reason}</span> : null}
        {note ? <span className="font-medium"> · {note}</span> : null}
      </span>
    </Badge>
  );
}

const verdictBlock = cva("flex items-center gap-3.5 rounded-(--radius-card) p-4", {
  variants: {
    status: {
      met: "bg-status-met-bg",
      barrier: "bg-status-barrier-bg",
      conflict: "bg-status-conflict-bg",
      unknown: "border-[1.5px] border-dashed border-status-unknown bg-status-unknown-bg",
    },
  },
});

export interface VerdictBlockProps {
  status: Status;
  label: string;
  reason?: string;
  note?: string;
  sub?: string;
  className?: string;
}

export function VerdictBlock({ status, label, reason, note, sub, className }: VerdictBlockProps) {
  const changed = useChanged(status);
  return (
    <div data-status={status} className={cn(verdictBlock({ status }), "transition-colors duration-(--duration-base)", className)}>
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-card">
        <StatusIcon key={status} status={status} className={cn("size-7", changed && "motion-fade")} />
      </span>
      <div key={status} className={cn("min-w-0", changed && "motion-fade")}>
        <p className={cn("text-title font-semibold", statusTextClass[status])}>
          {label}
          {reason ? ` · ${reason}` : null}
        </p>
        {note ? <p className="text-caption font-semibold tracking-[0.04em] text-foreground uppercase">{note}</p> : null}
        {sub ? <p className="text-body-sm text-foreground">{sub}</p> : null}
      </div>
    </div>
  );
}

const RELIABILITY_ICON: Record<Reliability, Icon> = {
  confirmed: SealCheck,
  unverified: SealQuestion,
  outdated: ClockCounterClockwise,
  conflict: WarningDiamond,
  unknown: Question,
};

const RELIABILITY_TONE: Record<Reliability, string> = {
  confirmed: "text-status-met",
  unverified: "text-muted-foreground",
  outdated: "text-status-conflict",
  conflict: "text-status-conflict",
  unknown: "text-status-unknown",
};

export interface ReliabilityBadgeProps {
  value: Reliability;
  /** The reliability word, e.g. "Potwierdzone". */
  label: string;
  className?: string;
}

export function ReliabilityBadge({ value, label, className }: ReliabilityBadgeProps) {
  const I = RELIABILITY_ICON[value];
  return (
    <span
      data-reliability={value}
      className={cn(
        "inline-flex items-center gap-1 text-caption font-semibold whitespace-nowrap",
        RELIABILITY_TONE[value],
        className,
      )}
    >
      <I weight={value === "confirmed" || value === "conflict" ? "fill" : "bold"} className="size-4 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

export interface SampleTagProps {
  /** Visible text, "Przykład". */
  label: string;
  /** Spoken text, "Dane przykładowe". */
  ariaLabel: string;
  className?: string;
}

export function SampleTag({ label, ariaLabel, className }: SampleTagProps) {
  return (
    <Badge variant="sample" className={className}>
      <span aria-hidden>{label}</span>
      <span className="sr-only">{ariaLabel}</span>
    </Badge>
  );
}
