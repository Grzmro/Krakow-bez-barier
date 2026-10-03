"use client";

import { useEffect, useEffectEvent, useId, useState } from "react";
import { CircleNotch, Crosshair } from "@phosphor-icons/react";
import { useAnnounce } from "@krakow-bez-barier/ui";
import { useLocale, useMessages } from "@/i18n/client";
import { intlLocale, type Locale } from "@/i18n/locale";
import type { Messages } from "@/i18n/messages";
import { locateDevice, type LocateResult } from "@/lib/native/geolocation";
import { locationSettings } from "@/lib/native/platform";
import { locateFailureText } from "@/lib/nearby";

function describe(result: LocateResult, t: Messages["nearby"], locale: Locale): string {
  if (!result.ok) {
    const { message, help } = locateFailureText(result.reason, locationSettings(), t);
    return help ? `${message} ${help}` : message;
  }
  const { latitude, longitude, accuracyMeters } = result.position;
  const coordinate = new Intl.NumberFormat(intlLocale[locale], { minimumFractionDigits: 5, maximumFractionDigits: 5 });
  return t.found(coordinate.format(latitude), coordinate.format(longitude), accuracyMeters);
}

/**
 * "W mojej okolicy": asks for the device position and shows it; the position stays on the device.
 * A failure says why and what to do; the same button then tries again.
 * `autoStart` asks right away (the /dev/native diagnostics page) instead of waiting for a tap.
 */
export function NearMe({ autoStart = false }: { autoStart?: boolean }) {
  const t = useMessages().nearby;
  const locale = useLocale();
  const announce = useAnnounce();
  const privacyId = useId();
  const [locating, setLocating] = useState(autoStart);
  const [result, setResult] = useState<LocateResult | null>(null);

  async function locate() {
    if (locating) return;
    setLocating(true);
    const next = await locateDevice();
    setResult(next);
    setLocating(false);
    announce(describe(next, t, locale));
  }

  const announceResult = useEffectEvent((next: LocateResult) => announce(describe(next, t, locale)));

  useEffect(() => {
    if (!autoStart) return;
    let active = true;
    locateDevice().then((next) => {
      if (!active) return;
      setResult(next);
      setLocating(false);
      announceResult(next);
    });
    return () => {
      active = false;
    };
  }, [autoStart]);

  return (
    <div className="rounded-2xl bg-primary-container p-2">
      <button
        type="button"
        onClick={locate}
        aria-disabled={locating}
        aria-describedby={privacyId}
        className="press flex min-h-16 w-full items-center gap-3.5 rounded-xl px-2 text-left aria-disabled:opacity-70"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          {locating ? (
            <CircleNotch weight="bold" className="size-[22px] animate-spin" aria-hidden />
          ) : (
            <Crosshair weight="bold" className="size-[22px]" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold">{t.action}</span>
          <span className="block text-caption text-muted-foreground">{locating ? t.locating : result && !result.ok ? t.retry : t.actionSub}</span>
        </span>
      </button>
      {result && <p className="px-2 pt-2 text-body font-semibold">{describe(result, t, locale)}</p>}
      <p id={privacyId} className="px-2 pt-1 pb-1 text-caption text-muted-foreground">
        {t.privacy}
      </p>
    </div>
  );
}
