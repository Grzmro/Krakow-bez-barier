"use client";

import { Translate } from "@phosphor-icons/react";
import { RadioGroup } from "@krakow-bez-barier/ui";
import { useLocale, useMessages, useSetLocale } from "@/i18n/client";
import { localeNames, locales } from "@/i18n/locale";

/** PL/EN choice in the menu (or, `compact`, in the desktop header), as a segmented radio group; each name is written in its own language. */
export function LanguageSwitch({ className, compact }: { className?: string; compact?: boolean }) {
  const t = useMessages().common.language;
  const locale = useLocale();
  const setLocale = useSetLocale();
  return (
    <RadioGroup
      legend={
        <>
          <Translate aria-hidden weight="bold" className="size-4" />
          {t.label}
        </>
      }
      legendHidden={compact}
      legendClassName="flex items-center gap-2 px-1 pb-0 text-caption text-muted-foreground"
      variant="segmented"
      size={compact ? "sm" : "default"}
      value={locale}
      onValueChange={setLocale}
      className={className}
      listClassName={compact ? "w-auto" : undefined}
      options={locales.map((option) => ({
        value: option,
        lang: option,
        label: localeNames[option],
        className: compact ? "flex-none px-4 text-[14px]" : "flex-1",
      }))}
    />
  );
}
