"use client";

import { Armchair, BabyCarriage, PersonSimpleWalk, Wheelchair, type Icon } from "@phosphor-icons/react";
import type { Profile } from "@krakow-bez-barier/contracts";
import { RadioGroup } from "@krakow-bez-barier/ui";
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
  const current: Option = value ?? "off";
  const options: Option[] = allowOff ? ["off", ...PROFILES] : [...PROFILES];
  const crowded = options.length > 3;
  return (
    <RadioGroup<Option>
      legend={t.switch.label}
      legendHidden
      variant="segmented"
      size={size}
      value={current}
      onValueChange={(option) => onChange(option === "off" ? null : option)}
      className={cn("@container", className)}
      options={options.map((option) => {
        const I = ICON[option];
        return {
          value: option,
          ariaLabel: option === "off" ? t.switch.offAria : t.name[option],
          // Segments size to their text so "Dla każdego" is never cut on a 360 px phone.
          className: cn("px-1 @sm:px-2", crowded ? "flex-auto @max-sm:text-[13px]" : "flex-1"),
          icon:
            option === "off"
              ? undefined
              : (checked: boolean) => (
                  <I aria-hidden weight={checked ? "fill" : "regular"} className={cn("size-[18px] shrink-0", crowded && "hidden @sm:block")} />
                ),
          label: option === "off" ? t.switch.off : t.switch.short[option],
        };
      })}
    />
  );
}
