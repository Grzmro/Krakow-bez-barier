"use client";

import { useId } from "react";
import { Translate } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useLocale, useMessages, useSetLocale } from "@/i18n/client";
import { localeNames, locales } from "@/i18n/locale";

/** PL/EN choice in the menu (or, `compact`, in the desktop header), as a segmented radio group; each name is written in its own language. */
export function LanguageSwitch({ className, compact }: { className?: string; compact?: boolean }) {
  const name = useId();
  const t = useMessages().common.language;
  const locale = useLocale();
  const setLocale = useSetLocale();
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend
        className={cn(
          "flex items-center gap-2 px-1 pb-2 text-caption font-semibold text-muted-foreground",
          compact && "sr-only",
        )}
      >
        <Translate aria-hidden weight="bold" className="size-4" />
        {t.label}
      </legend>
      <div className={cn("flex rounded-full bg-muted p-1 ring-1 ring-border", compact ? "w-auto" : "w-full")}>
        {locales.map((option) => (
          <label
            key={option}
            lang={option}
            className={cn(
              "relative flex h-12 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-full px-2 text-[14px] font-semibold text-muted-foreground transition-[background-color,color,box-shadow] duration-(--duration-base) hover:text-foreground has-checked:bg-primary has-checked:text-primary-foreground has-checked:shadow-soft has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
              compact && "h-10 flex-none px-4",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={locale === option}
              onChange={() => setLocale(option)}
              className="absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-full opacity-0"
            />
            <span className="truncate">{localeNames[option]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
