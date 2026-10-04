"use client";

import type { ReactNode } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { cn } from "../cn";

/** The floating list of a combobox, autocomplete or select. */
export const popupClass =
  "max-w-(--available-width) overflow-hidden rounded-3xl bg-popover text-popover-foreground shadow-float ring-1 ring-border outline-none";

/** One option in that list: 48 px tall, highlighted with the primary container (keyboard and pointer alike). */
export const optionClass =
  "flex min-h-12 cursor-default items-center gap-3 px-4 py-2 text-body outline-none select-none data-disabled:opacity-50 data-highlighted:bg-primary-container data-highlighted:text-foreground";

export interface ComboboxPopupProps {
  /** Accessible name of the list. */
  label: string;
  /** Under the list: an empty-result or status line. */
  footer?: ReactNode;
  className?: string;
  /** The list's render function (`(item) => <Item/>`) or items. */
  children: Combobox.List.Props["children"];
}

/**
 * Portal + positioner + popup + list for a Base UI `Combobox` or `Autocomplete` (they share these parts), in the
 * field's width. Items go in as `children`, styled with `optionClass`.
 */
export function ComboboxPopup({ label, footer, className, children }: ComboboxPopupProps) {
  return (
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={8} className="z-50 outline-none">
        <Combobox.Popup aria-label={label} className={cn(popupClass, "w-(--anchor-width) py-2 data-empty:hidden", className)}>
          <Combobox.List className="max-h-[min(22rem,var(--available-height))] overflow-y-auto">
            {children}
          </Combobox.List>
          {footer}
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}
