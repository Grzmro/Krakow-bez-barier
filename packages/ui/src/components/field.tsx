"use client";

import { createContext, useContext, useId, type AriaAttributes, type ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { cn } from "../cn";

type FieldIds = { id: string; describedBy: string | undefined; invalid: boolean; disabled: boolean };

const FieldContext = createContext<FieldIds | null>(null);

/** Joins `aria-describedby` id lists, dropping empty parts. */
export function describedBy(...ids: (string | false | null | undefined)[]): string | undefined {
  const joined = ids.filter(Boolean).join(" ");
  return joined || undefined;
}

/**
 * The id, `aria-describedby` and `aria-invalid` a control inside a `Field` takes. Its own props win over the
 * field's id; describedby lists are merged (error first, so a screen reader reads the problem before the hint).
 */
export function useFieldControl(props: {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  disabled?: boolean;
}) {
  const field = useContext(FieldContext);
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true" || !!field?.invalid;
  return {
    id: props.id ?? field?.id,
    "aria-describedby": describedBy(field?.describedBy, props["aria-describedby"]),
    "aria-invalid": invalid || undefined,
    disabled: props.disabled ?? (field?.disabled || undefined),
  };
}

export const fieldLabelClass = "block text-body-sm font-semibold text-foreground";
export const fieldHintClass = "text-caption text-muted-foreground";
export const fieldErrorClass = "flex items-start gap-1.5 text-caption font-semibold text-destructive";

/** Error line under a control: an icon and the text, so the problem never rests on colour alone. */
export function FieldError({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} className={cn(fieldErrorClass, className)}>
      <WarningCircle weight="fill" className="mt-px size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export interface FieldProps {
  /** Visible label. Every field has one: a placeholder is never the only label. */
  label: ReactNode;
  /** Extra words after the label for screen readers only (e.g. the unit). */
  labelExtra?: ReactNode;
  /** Keeps the label for assistive tech only — for controls whose look already names them (the map search). */
  labelHidden?: boolean;
  hint?: ReactNode;
  /** Shown instead of the hint's colour: the control turns invalid and the text is read with it. */
  error?: ReactNode;
  /**
   * Character counter, right-aligned under the control: "12 / 500" on screen, `label` ("12 z 500 znaków") for screen
   * readers through `aria-describedby`. Over `max` it turns into the error colour; the limit itself is the caller's.
   */
  counter?: { count: number; max: number; label: string };
  disabled?: boolean;
  /** The control's id; generated when left out. */
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A labelled form field: label above, control, then the hint or the error below — both tied to the control with
 * `aria-describedby`. Controls from this package (`Input`, `Textarea`, `Select`) pick up the ids.
 */
export function Field({ label, labelExtra, labelHidden, hint, error, counter, disabled = false, id, className, children }: FieldProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const counterId = `${controlId}-count`;
  const invalid = error != null && error !== false && error !== "";
  const value: FieldIds = {
    id: controlId,
    describedBy: describedBy(invalid && errorId, hint ? hintId : undefined, counter && counterId),
    invalid,
    disabled,
  };
  return (
    <div data-slot="field" data-invalid={invalid || undefined} className={cn("min-w-0", className)}>
      <label htmlFor={controlId} className={cn(fieldLabelClass, "mb-2", labelHidden && "sr-only", disabled && "text-muted-foreground")}>
        {label}
        {labelExtra ? <span className="sr-only"> {labelExtra}</span> : null}
      </label>
      <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
      {invalid || hint || counter ? (
        <div className="mt-1.5 flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            {invalid ? <FieldError id={errorId}>{error}</FieldError> : null}
            {hint ? (
              <p id={hintId} className={fieldHintClass}>
                {hint}
              </p>
            ) : null}
          </div>
          {counter ? (
            <p id={counterId} className={cn("shrink-0 text-caption tabular-nums", counter.count > counter.max ? "font-semibold text-destructive" : "text-muted-foreground")}>
              <span aria-hidden>
                {counter.count} / {counter.max}
              </span>
              <span className="sr-only">{counter.label}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
