"use client";

import { type FormEvent, type Ref, useId, useImperativeHandle, useRef, useState } from "react";
import { ArrowClockwise, CircleNotch, Crosshair } from "@phosphor-icons/react";
import { Button, Field, Select, Toggle, useAnnounce } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import { KRAKOW_DISTRICTS } from "@/lib/districts";
import { locateDevice } from "@/lib/native/geolocation";
import { locationSettings } from "@/lib/native/platform";
import { locateFailureText, type NearbyOrigin } from "@/lib/nearby";

export type NearbyToggleHandle = { locate: () => void };

const DISTRICT_ITEMS = KRAKOW_DISTRICTS.map((d) => ({ value: d.id, label: d.name }));

/**
 * "W mojej okolicy" on the home list: pressed, it asks for the device position and hands it up so the
 * list sorts from the user; pressed again, the list goes back to distances from Rynek. A failure says
 * why and what to do and offers a retry. A district can always be picked by hand instead, so the list
 * works without sharing the position at all (the picker opens by itself after a failure).
 */
export function NearbyToggle({
  origin,
  onChange,
  privacy,
  ref,
}: {
  origin: NearbyOrigin | null;
  onChange: (origin: NearbyOrigin | null) => void;
  /** What is sent to the search, when the area is no longer the default ~2 km. */
  privacy?: string;
  /** Lets another control (a quick action) ask for the position the same way, with the same failure help. */
  ref?: Ref<NearbyToggleHandle>;
}) {
  const t = useMessages().nearby;
  const announce = useAnnounce();
  const privacyId = useId();
  const errorId = useId();
  const manualId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<{ message: string; help: string | null } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [district, setDistrict] = useState("");

  useImperativeHandle(ref, () => ({ locate: () => void locate() }));

  async function locate() {
    if (locating) return;
    setLocating(true);
    const result = await locateDevice();
    setLocating(false);
    if (result.ok) {
      const focusInProblem = problemRef.current?.contains(document.activeElement);
      setError(null);
      onChange({ position: result.position });
      if (focusInProblem) toggleRef.current?.focus();
    } else {
      const text = locateFailureText(result.reason, locationSettings(), t);
      setError(text);
      setManualOpen(true);
      announce([text.message, text.help].filter(Boolean).join(" "));
    }
  }

  function toggle() {
    if (locating) return;
    if (origin) {
      setError(null);
      onChange(null);
    } else void locate();
  }

  function choose(event: FormEvent) {
    event.preventDefault();
    const chosen = KRAKOW_DISTRICTS.find((d) => d.id === district);
    if (!chosen) return;
    setError(null);
    setManualOpen(false);
    setDistrict("");
    onChange({ position: { latitude: chosen.latitude, longitude: chosen.longitude }, place: chosen.name });
    // The picker closes; keep focus on the control that now shows the choice.
    toggleRef.current?.focus();
  }

  const caption = locating ? t.locating : origin ? (origin.place ? t.home.sortOnChosen(origin.place) : t.home.sortOn) : t.home.sortOff;

  return (
    <div>
      <div className="flex min-h-12 items-center gap-3">
        <Toggle
          ref={toggleRef}
          pressed={Boolean(origin)}
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
        <span className="min-w-0 text-caption text-muted-foreground">{caption}</span>
      </div>
      {error ? (
        <div ref={problemRef} role="group" aria-labelledby={errorId} className="mt-1 space-y-2 rounded-2xl bg-muted p-3">
          <p id={errorId} className="text-body-sm font-semibold">
            {error.message}
          </p>
          {error.help ? <p className="text-body-sm">{error.help}</p> : null}
          <Button variant="outline" size="sm" onClick={() => void locate()} aria-disabled={locating}>
            <ArrowClockwise weight="bold" aria-hidden />
            {t.retry}
          </Button>
        </div>
      ) : null}
      <Button
        variant="link"
        size="sm"
        className="h-10 px-1"
        aria-expanded={manualOpen}
        aria-controls={manualId}
        onClick={() => setManualOpen((open) => !open)}
      >
        {t.manual.open}
      </Button>
      <form id={manualId} hidden={!manualOpen} onSubmit={choose} className="space-y-2 pb-2">
        <Field label={t.manual.label}>
          <div className="flex flex-wrap gap-2">
            <Select
              items={DISTRICT_ITEMS}
              value={district || null}
              onValueChange={setDistrict}
              placeholder={t.manual.placeholder}
              className="w-auto flex-1 basis-48"
            />
            <Button type="submit" variant="outline" aria-disabled={!district}>
              {t.manual.submit}
            </Button>
          </div>
        </Field>
      </form>
      <p id={privacyId} className={origin ? "pt-1 text-caption text-muted-foreground" : "sr-only"}>
        {privacy ?? t.home.privacy}
      </p>
    </div>
  );
}
