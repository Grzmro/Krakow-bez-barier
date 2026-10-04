"use client";

import type { ComponentProps, ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../cn";
import { useFieldControl } from "./field";

/** Marks the text control inside an `InputGroup`; the group draws focus, invalid and disabled states from it. */
export const INPUT_CONTROL = "input-control";

const inputGroupVariants = cva(
  [
    "group/input relative flex w-full min-w-0 items-center text-foreground transition-[border-color,background-color,box-shadow] duration-(--duration-fast)",
    // The whole field shows focus (3 px outline, 2 px offset, like buttons), so the icon and clear button sit inside it.
    `has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring`,
    `has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60`,
  ],
  {
    variants: {
      variant: {
        /** Form field: 1.5 px border (3:1 against the card), card background. */
        default: [
          "rounded-2xl border-[1.5px] border-input bg-card hover:border-foreground/70",
          `has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:hover:border-destructive`,
          `has-[input:read-only]:border-dashed has-[input:read-only]:bg-muted has-[input:read-only]:hover:border-input`,
        ],
        /** Floats over the map: a pill with a shadow instead of a border. */
        floating: "rounded-full bg-card shadow-float",
        /** Sits in a row of a card that already draws the frame (route start). */
        inline: "rounded-xl bg-transparent",
      },
      size: {
        default: "h-12",
        floating: "h-[52px]",
        lg: "h-14",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

/**
 * Class for the text control inside an `InputGroup` (an `<input>`, or a Base UI combobox input). 17 px text, so
 * iOS never zooms the page on focus (it does below 16 px).
 */
export const inputControlClass =
  "h-full w-full min-w-0 flex-1 bg-transparent px-4 text-body text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed group-data-start/input:pl-0 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none";

export type InputGroupProps = VariantProps<typeof inputGroupVariants> & {
  /** Decorative icon before the text (kept out of the accessibility tree). */
  startIcon?: ReactNode;
  /** Buttons or text after the text: clear, voice, a unit. */
  end?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** The frame of a text field: border, background, icon, end slot and every state. Put an `inputControlClass` control inside. */
export function InputGroup({ variant, size, startIcon, end, className, children }: InputGroupProps) {
  return (
    <div
      data-slot="input-group"
      data-start={startIcon ? "" : undefined}
      className={cn(inputGroupVariants({ variant, size }), className)}
    >
      {startIcon ? (
        <span
          aria-hidden
          className="pointer-events-none flex shrink-0 items-center pr-3 pl-4 text-muted-foreground group-has-[input:focus-visible]/input:text-foreground [&_svg:not([class*='size-'])]:size-5"
        >
          {startIcon}
        </span>
      ) : null}
      {children}
      {end ? <span className="flex shrink-0 items-center gap-1 pr-1.5 pl-1">{end}</span> : null}
    </div>
  );
}

/** Round 40 px "clear" button for the end of a field. */
export function InputClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <X weight="bold" className="size-5" aria-hidden />
    </button>
  );
}

export interface InputProps extends Omit<ComponentProps<"input">, "size">, VariantProps<typeof inputGroupVariants> {
  startIcon?: ReactNode;
  /** Extra content at the end (a unit, a button). */
  end?: ReactNode;
  /** With `clearLabel`, shows a clear button while the field holds text. */
  onClear?: () => void;
  clearLabel?: string;
  /** Classes for the `<input>` itself; `className` styles the frame. */
  inputClassName?: string;
}

/** Text field, 48 px (56 px `lg`) like the buttons. Wrap it in `Field` for the label, hint and error. */
export function Input({
  variant,
  size,
  startIcon,
  end,
  onClear,
  clearLabel,
  className,
  inputClassName,
  ...props
}: InputProps) {
  const control = useFieldControl(props);
  const showClear = onClear && clearLabel && typeof props.value === "string" && props.value !== "" && !props.readOnly && !control.disabled;
  return (
    <InputGroup
      variant={variant}
      size={size}
      startIcon={startIcon}
      end={
        showClear || end ? (
          <>
            {end}
            {showClear ? <InputClearButton label={clearLabel} onClick={onClear} /> : null}
          </>
        ) : null
      }
      className={className}
    >
      <input
        data-slot={INPUT_CONTROL}
        {...props}
        {...control}
        className={cn(inputControlClass, size === "lg" && "font-display text-[22px] font-extrabold tabular-nums", inputClassName)}
      />
    </InputGroup>
  );
}
