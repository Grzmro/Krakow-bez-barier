"use client";

import { useId, useState } from "react";
import { CircleNotch, Crosshair } from "@phosphor-icons/react";
import { Toggle, useAnnounce } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import { locateDevice, type DevicePosition } from "@/lib/native/geolocation";

/**
 * "W mojej okolicy" on the home list: pressed, it asks for the device position and hands it up so the
 * list sorts from the user; pressed again, the list goes back to distances from Rynek. A refusal or a
 * failed fix is shown and announced, and the list keeps working as before.
 */
export function NearbyToggle({ active, onChange }: { active: boolean; onChange: (position: DevicePosition | null) => void }) {
  const t = useMessages().nearby;
  const announce = useAnnounce();
  const privacyId = useId();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (locating) return;
    setError(null);
    if (active) {
      onChange(null);
      return;
    }
    setLocating(true);
    const result = await locateDevice();
    setLocating(false);
    if (result.ok) {
      onChange(result.position);
    } else {
      setError(t.errors[result.reason]);
      announce(t.errors[result.reason]);
    }
  }

  return (
    <div>
      <div className="flex min-h-12 items-center gap-3">
        <Toggle
          pressed={active}
          onPressedChange={toggle}
          aria-disabled={locating}
          aria-describedby={privacyId}
          className="h-11 px-4 aria-disabled:opacity-70"
        >
          {locating ? (
            <CircleNotch weight="bold" className="size-5 animate-spin" aria-hidden />
          ) : (
            <Crosshair weight="bold" className="size-5" aria-hidden />
          )}
          {t.action}
        </Toggle>
        <span className="min-w-0 text-caption text-muted-foreground">
          {locating ? t.locating : active ? t.home.sortOn : t.home.sortOff}
        </span>
      </div>
      {error ? <p className="pt-1 text-body-sm font-semibold">{error}</p> : null}
      <p id={privacyId} className={active ? "pt-1 text-caption text-muted-foreground" : "sr-only"}>
        {t.home.privacy}
      </p>
    </div>
  );
}
