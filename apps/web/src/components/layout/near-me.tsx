"use client";

import { useEffect, useId, useState } from "react";
import { CircleNotch, Crosshair } from "@phosphor-icons/react";
import { useAnnounce } from "@krakow-bez-barier/ui";
import { pl } from "@/i18n/pl";
import { locateDevice, type LocateResult } from "@/lib/native/geolocation";

const t = pl.nearby;
const coordinate = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 5, maximumFractionDigits: 5 });

function describe(result: LocateResult): string {
  if (!result.ok) return t.errors[result.reason];
  const { latitude, longitude, accuracyMeters } = result.position;
  return t.found(coordinate.format(latitude), coordinate.format(longitude), accuracyMeters);
}

/**
 * "W mojej okolicy": asks for the device position and shows it; the position stays on the device.
 * `autoStart` asks right away (the /dev/native diagnostics page) instead of waiting for a tap.
 */
export function NearMe({ autoStart = false }: { autoStart?: boolean }) {
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
    announce(describe(next));
  }

  useEffect(() => {
    if (!autoStart) return;
    let active = true;
    locateDevice().then((next) => {
      if (!active) return;
      setResult(next);
      setLocating(false);
      announce(describe(next));
    });
    return () => {
      active = false;
    };
  }, [autoStart, announce]);

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
          <span className="block text-caption text-muted-foreground">{locating ? t.locating : t.actionSub}</span>
        </span>
      </button>
      {result && <p className="px-2 pt-2 text-body font-semibold">{describe(result)}</p>}
      <p id={privacyId} className="px-2 pt-1 pb-1 text-caption text-muted-foreground">
        {t.privacy}
      </p>
    </div>
  );
}
