"use client";

import type { ReactNode } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "../cn";
import { useFieldControl } from "./field";
import { optionClass, popupClass } from "./combobox";

export type SelectItem<T extends string> = { value: T; label: string; disabled?: boolean };

export interface SelectProps<T extends string> {
  items: readonly SelectItem<T>[];
  /** `null` = nothing chosen yet: the placeholder shows. */
  value: T | null;
  onValueChange: (value: T) => void;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
  /** Extra content after an option's label (e.g. a PRZYKŁAD tag). */
  renderExtra?: (item: SelectItem<T>) => ReactNode;
}

/**
 * Pick one of a fixed list (Base UI Select): a 48 px trigger that looks like the text fields, a popup list with a
 * check on the chosen option. Wrap it in `Field` for the label, hint and error.
 */
export function Select<T extends string>({
  items,
  value,
  onValueChange,
  placeholder,
  name,
  disabled,
  className,
  renderExtra,
  ...props
}: SelectProps<T>) {
  const control = useFieldControl({ ...props, disabled });
  return (
    <SelectPrimitive.Root<T>
      items={items as SelectItem<T>[]}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      name={name}
      disabled={control.disabled}
    >
      <SelectPrimitive.Trigger
        id={control.id}
        aria-describedby={control["aria-describedby"]}
        aria-invalid={control["aria-invalid"]}
        className={cn(
          "group/select flex h-12 w-full min-w-0 items-center gap-2 rounded-2xl border-[1.5px] border-input bg-card pr-3 pl-4 text-left text-body text-foreground transition-[border-color,background-color] duration-(--duration-fast) outline-none hover:border-foreground/70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-60 data-popup-open:border-foreground/70 aria-invalid:border-destructive",
          className,
        )}
      >
        <SelectPrimitive.Value
          placeholder={placeholder}
          className="min-w-0 flex-1 truncate data-placeholder:text-muted-foreground"
        />
        <SelectPrimitive.Icon className="shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) group-data-popup-open/select:rotate-180">
          <CaretDown weight="bold" className="size-5" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={8} alignItemWithTrigger={false} className="z-50 outline-none">
          <SelectPrimitive.Popup className={cn(popupClass, "min-w-(--anchor-width)")}>
            <SelectPrimitive.List className="max-h-[min(22rem,var(--available-height))] overflow-y-auto py-2">
              {items.map((item) => (
                <SelectPrimitive.Item key={item.value} value={item.value} disabled={item.disabled} className={optionClass}>
                  <SelectPrimitive.ItemText className="min-w-0 flex-1">{item.label}</SelectPrimitive.ItemText>
                  {renderExtra?.(item)}
                  <SelectPrimitive.ItemIndicator className="shrink-0">
                    <Check weight="bold" className="size-5 text-primary" aria-hidden />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
