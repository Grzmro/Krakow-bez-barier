"use client";

import { useId } from "react";
import { Translate } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useLocale, useMessages, useSetLocale } from "@/i18n/client";
import { localeNames, locales } from "@/i18n/locale";

/** PL/EN choice in the menu, as a segmented radio group; each name is written in its own language. */
export function LanguageSwitch({ className }: { className?: string }) {
  const name = useId();
  const t = useMessages().common.language;
  const locale = useLocale();
  const setLocale = useSetLocale();
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="flex items-center gap-2 px-1 pb-2 text-caption font-semibold text-muted-foreground">
        <Translate aria-hidden weight="bold" className="size-4" />
        {t.label}
      </legend>
      <div className="flex w-full rounded-full bg-muted p-1 ring-1 ring-border">
        {locales.map((option) => (
          <label
            key={option}
            lang={option}
            className="relative flex h-12 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-full px-2 text-[14px] font-semibold text-muted-foreground transition-[background-color,color,box-shadow] duration-200 hover:text-foreground has-checked:bg-primary has-checked:text-primary-foreground has-checked:shadow-soft has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
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
