"use client";

import { useId } from "react";
import { cn } from "../cn";

export interface LabeledSwitchProps {
  label: string;
  /** Extra line under the label, read as the switch's description. */
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

/** A whole-row on/off switch (native checkbox with `role="switch"`), 48 px tall like the prototype. */
export function LabeledSwitch({ label, hint, checked, onCheckedChange, className }: LabeledSwitchProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn("flex min-h-12 cursor-pointer items-center justify-between gap-3 text-body-sm font-semibold", className)}
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
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className="h-7 w-12 rounded-full bg-muted-foreground transition-colors duration-150 peer-checked:bg-primary peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-0.5 left-0.5 size-6 rounded-full bg-card shadow-soft transition-transform duration-150 peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}
