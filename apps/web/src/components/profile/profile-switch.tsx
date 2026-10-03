"use client";

import { useId } from "react";
import { Armchair, BabyCarriage, PersonSimpleWalk, Wheelchair, type Icon } from "@phosphor-icons/react";
import type { Profile } from "@krakow-bez-barier/contracts";
import { cn } from "@/lib/utils";
import { useMessages } from "@/i18n/client";
import { PROFILES } from "@/lib/profile/thresholds";

type Option = Profile | "off";

const ICON: Record<Option, Icon> = { off: PersonSimpleWalk, wheelchair: Wheelchair, stroller: BabyCarriage, senior: Armchair };

/** One-tap profile choice as a segmented radio group: arrow keys move, the app never requires a profile. */
export function ProfileSwitch({
  value,
  onChange,
  allowOff = true,
  size = "default",
  className,
}: {
  value: Profile | null;
  onChange: (profile: Profile | null) => void;
  /** Show the "for everyone" segment; the threshold editor hides it. */
  allowOff?: boolean;
  /** `sm` is the compact variant used inside the thresholds drawer. */
  size?: "default" | "sm";
  className?: string;
}) {
  const t = useMessages().profile;
  const name = useId();
  const current: Option = value ?? "off";
  const options: Option[] = allowOff ? ["off", ...PROFILES] : [...PROFILES];
  return (
    <fieldset className={cn("@container min-w-0", className)}>
      <legend className="sr-only">{t.switch.label}</legend>
      <div
        className={cn(
          "w-full bg-muted p-1 ring-1 ring-border",
          "flex rounded-full",
        )}
      >
        {options.map((option) => {
          const I = ICON[option];
          const checked = current === option;
          return (
            <label
              key={option}
              className={cn(
                "relative flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-full px-1 @sm:px-2 font-semibold text-muted-foreground transition-[background-color,color,box-shadow] duration-200 hover:text-foreground has-checked:bg-primary has-checked:text-primary-foreground has-checked:shadow-soft has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                // Segments size to their text so "Dla każdego" is never cut on a 360 px phone.
                options.length > 3 ? "flex-auto" : "flex-1",
                size === "sm" ? "h-10 text-[13px]" : "h-12 text-[14px]",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={checked}
                aria-label={option === "off" ? t.switch.offAria : t.name[option]}
                onChange={() => onChange(option === "off" ? null : option)}
                className="absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-full opacity-0"
              />
              {option === "off" ? null : (
                <I
                  aria-hidden
                  weight={checked ? "fill" : "regular"}
                  className={cn("size-[18px] shrink-0", options.length > 3 && "hidden @sm:block")}
                />
              )}
              <span className={cn(options.length > 3 ? "@max-sm:text-[13px]" : undefined, "truncate")}>{option === "off" ? t.switch.off : t.switch.short[option]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
