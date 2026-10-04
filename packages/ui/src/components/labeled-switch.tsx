"use client";

import { useId } from "react";
import { cn } from "../cn";

export interface LabeledSwitchProps {
  label: string;
  /** Extra line under the label, read as the switch's description. */
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A whole-row on/off switch, 48 px tall: a native checkbox with `role="switch"` under a 48×28 px track. Off is the
 * input-border grey (3:1 against the card), on is primary; the thumb moves, so the state never rests on colour alone.
 */
export function LabeledSwitch({ label, hint, checked, onCheckedChange, disabled, className }: LabeledSwitchProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-12 cursor-pointer items-center justify-between gap-3 text-body-sm font-semibold has-disabled:cursor-not-allowed has-disabled:opacity-60",
        className,
      )}
    >
      <span className="min-w-0">
        {label}
        {hint ? (
          <span id={`${id}-hint`} className="block text-caption font-medium text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden
          className="h-7 w-12 rounded-full bg-input transition-colors duration-(--duration-fast) peer-checked:bg-primary peer-hover:bg-muted-foreground peer-checked:peer-hover:bg-primary-hover peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-0.5 left-0.5 size-6 rounded-full bg-card shadow-soft transition-transform duration-(--duration-fast) peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}
