"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { Check } from "@phosphor-icons/react";
import { cva } from "class-variance-authority";
import { cn } from "../cn";
import { describedBy, FieldError, fieldHintClass } from "./field";

// Native checkbox/radio inputs stay in the page (invisible), so forms, label clicks, arrow keys between radios and
// every screen reader work as the platform does; only the look is ours. Over a box or segment the input covers it.
const hiddenInput = "peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-[inherit] opacity-0 disabled:cursor-not-allowed";
// Options with text beside the control keep the input visually hidden instead, so the label text itself takes the tap.
const srOnlyInput = "peer sr-only";
const focusRing = "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring";

export interface CheckboxProps {
  label: ReactNode;
  hint?: ReactNode;
  /** E.g. a consent that must be given: the box turns invalid and the text is read with it. */
  error?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
}

/** A 24 px box with its label on a 48 px row; the whole row toggles it. */
export function Checkbox({ label, hint, error, checked, onCheckedChange, disabled, name, className }: CheckboxProps) {
  const id = useId();
  const invalid = error != null && error !== false && error !== "";
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="flex min-h-12 cursor-pointer items-center gap-3 text-body-sm font-semibold has-disabled:cursor-not-allowed has-disabled:opacity-60"
      >
        <span className={cn("relative grid size-6 shrink-0 place-items-center rounded-md", focusRing)}>
          <input
            id={id}
            type="checkbox"
            name={name}
            checked={checked}
            disabled={disabled}
            aria-describedby={describedBy(invalid && `${id}-error`, hint ? `${id}-hint` : undefined)}
            aria-invalid={invalid || undefined}
            onChange={(event) => onCheckedChange(event.target.checked)}
            className={hiddenInput}
          />
          <span
            aria-hidden
            className="absolute inset-0 rounded-md border-2 border-input bg-card transition-colors duration-(--duration-fast) peer-checked:border-primary peer-checked:bg-primary peer-hover:border-foreground/70 peer-checked:peer-hover:border-primary-hover peer-checked:peer-hover:bg-primary-hover peer-aria-invalid:border-destructive"
          />
          <Check
            weight="bold"
            aria-hidden
            className="pointer-events-none relative size-4 text-primary-foreground opacity-0 transition-opacity duration-(--duration-fast) peer-checked:opacity-100"
          />
        </span>
        <span className="min-w-0">
          {label}
          {hint ? (
            <span id={`${id}-hint`} className={cn("block font-medium", fieldHintClass)}>
              {hint}
            </span>
          ) : null}
        </span>
      </label>
      {invalid ? (
        <FieldError id={`${id}-error`} className="ml-9">
          {error}
        </FieldError>
      ) : null}
    </div>
  );
}

const radioItemVariants = cva("relative flex min-w-0 cursor-pointer items-center select-none has-disabled:cursor-not-allowed has-disabled:opacity-60", {
  variants: {
    variant: {
      /** Big answer cards with a radio dot (report form). */
      card: "press h-14 gap-3 rounded-2xl bg-surface-raised px-4 text-body font-semibold ring-[1.5px] ring-input not-has-checked:hover:ring-foreground/70 has-checked:bg-primary-container has-checked:ring-2 has-checked:ring-primary",
      /** Pill chips in a row (one of many attributes). */
      chip: "press h-10 shrink-0 rounded-full bg-card px-3.5 text-sm font-semibold whitespace-nowrap ring-1 ring-input not-has-checked:hover:bg-muted has-checked:bg-primary-container has-checked:ring-2 has-checked:ring-primary",
      /** Segments of one pill (profile, language): the chosen one is filled. */
      segmented:
        "justify-center gap-1 rounded-full px-2 font-semibold text-muted-foreground transition-[background-color,color,box-shadow] duration-(--duration-base) hover:text-foreground has-checked:bg-primary has-checked:text-primary-foreground has-checked:shadow-soft",
      /** Plain list rows with the dot in front. */
      plain: "min-h-12 gap-3 text-body",
    },
    size: { default: "", sm: "" },
  },
  compoundVariants: [
    { variant: "segmented", size: "default", className: "h-12 text-[14px]" },
    { variant: "segmented", size: "sm", className: "h-10 text-[13px]" },
  ],
  defaultVariants: { variant: "card", size: "default" },
});

const radioListVariants = cva("", {
  variants: {
    variant: {
      card: "grid gap-2.5",
      chip: "flex gap-2",
      segmented: "flex w-full rounded-full bg-muted p-1 ring-1 ring-border",
      plain: "grid",
    },
  },
  defaultVariants: { variant: "card" },
});

function RadioDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full ring-2 ring-input ring-inset transition-colors duration-(--duration-fast) group-has-checked/radio:bg-primary group-has-checked/radio:ring-primary",
        className,
      )}
    >
      <span className="size-2.5 rounded-full bg-primary-foreground opacity-0 group-has-checked/radio:opacity-100" />
    </span>
  );
}

export type RadioOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Name for assistive tech when the visible label is shortened. */
  ariaLabel?: string;
  /** Before the label; a function gets whether the option is chosen (e.g. a filled icon). */
  icon?: ReactNode | ((checked: boolean) => ReactNode);
  lang?: string;
  className?: string;
  /** Extra attributes for the native input (e.g. `data-autofocus`). */
  inputProps?: InputHTMLAttributes<HTMLInputElement> & Record<`data-${string}`, unknown>;
};

export interface RadioGroupProps<T extends string> {
  legend: ReactNode;
  legendHidden?: boolean;
  legendClassName?: string;
  options: readonly RadioOption<T>[];
  value: T | null;
  onValueChange: (value: T) => void;
  variant?: "card" | "chip" | "segmented" | "plain";
  size?: "default" | "sm";
  name?: string;
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  className?: string;
  listClassName?: string;
  listRef?: Ref<HTMLDivElement>;
  /** Attributes for the options' wrapper, e.g. `data-vaul-no-drag` on a sideways-scrolling chip row. */
  listProps?: Record<`data-${string}`, unknown>;
}

/**
 * One choice from a few: a `fieldset` with its legend and native radios (arrow keys move, Space picks), drawn as
 * cards, chips or a segmented pill. The hint or error below is tied to the group with `aria-describedby`.
 */
export function RadioGroup<T extends string>({
  legend,
  legendHidden,
  legendClassName,
  options,
  value,
  onValueChange,
  variant = "card",
  size = "default",
  name,
  hint,
  error,
  disabled,
  className,
  listClassName,
  listRef,
  listProps,
}: RadioGroupProps<T>) {
  const id = useId();
  const groupName = name ?? id;
  const invalid = error != null && error !== false && error !== "";
  return (
    <fieldset
      disabled={disabled}
      aria-describedby={describedBy(invalid && `${id}-error`, hint ? `${id}-hint` : undefined)}
      className={cn("min-w-0", className)}
    >
      <legend className={cn("mb-2 text-body-sm font-semibold", legendHidden && "sr-only", legendClassName)}>{legend}</legend>
      <div ref={listRef} {...listProps} className={cn(radioListVariants({ variant }), listClassName)}>
        {options.map((option) => {
          const checked = value === option.value;
          const icon = typeof option.icon === "function" ? option.icon(checked) : option.icon;
          return (
            <label
              key={option.value}
              lang={option.lang}
              className={cn("group/radio", radioItemVariants({ variant, size }), focusRing, option.className)}
            >
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={checked}
                aria-label={option.ariaLabel}
                aria-invalid={invalid || undefined}
                onChange={() => onValueChange(option.value)}
                {...option.inputProps}
                className={variant === "segmented" ? hiddenInput : srOnlyInput}
              />
              {variant === "plain" ? <RadioDot /> : null}
              {icon}
              <span className={cn("min-w-0", variant === "card" && "flex-1", variant === "segmented" && "truncate")}>{option.label}</span>
              {variant === "card" ? <RadioDot /> : null}
            </label>
          );
        })}
      </div>
      {invalid ? <FieldError id={`${id}-error`} className="mt-1.5">{error}</FieldError> : null}
      {hint ? (
        <p id={`${id}-hint`} className={cn("mt-1.5", fieldHintClass)}>
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}
