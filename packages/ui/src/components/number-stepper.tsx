"use client";

import { useId, useState } from "react";
import { Minus, Plus } from "@phosphor-icons/react";
import { cn } from "../cn";
import { Button } from "./button";
import { clampStep } from "./number-stepper-value";

export interface NumberStepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Shown after the number, e.g. "cm". */
  unit?: string;
  /** Names of the − / + buttons, e.g. "Zmniejsz: Próg". */
  decreaseLabel: string;
  increaseLabel: string;
  onChange: (value: number) => void;
  className?: string;
}

/**
 * A number with − / + buttons on a 48 px pill and its visible label in front. The number can also be typed (spinbutton,
 * arrow keys step it); a typed value is committed on Enter or blur, clamped to the range.
 */
export function NumberStepper({ label, value, min, max, step, unit, decreaseLabel, increaseLabel, onChange, className }: NumberStepperProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    const next = clampStep(raw, { min, max });
    if (next !== null) onChange(next);
    setDraft(null);
  };
  return (
    <div className={cn("flex min-h-14 items-center justify-between gap-3", className)}>
      <label htmlFor={id} className="min-w-0 text-body-sm font-semibold">
        {label}
      </label>
      <div role="group" aria-label={label} className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-1 ring-1 ring-border">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="bg-card shadow-soft hover:bg-card"
          aria-label={decreaseLabel}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          <Minus weight="bold" />
        </Button>
        <span className="flex w-20 items-baseline justify-center gap-1">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={draft ?? String(value)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit(e.currentTarget.value)}
            className="w-11 rounded-md bg-transparent text-center font-num text-[17px] text-foreground outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {unit ? (
            <span aria-hidden className="text-caption font-semibold text-muted-foreground">
              {unit}
            </span>
          ) : null}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="bg-card shadow-soft hover:bg-card"
          aria-label={increaseLabel}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          <Plus weight="bold" />
        </Button>
      </div>
    </div>
  );
}
