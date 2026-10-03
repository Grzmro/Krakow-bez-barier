"use client";

import { useEffect, useRef } from "react";
import { Pause, Play, SpeakerHigh, Stop } from "@phosphor-icons/react";
import type { Route } from "@krakow-bez-barier/contracts";
import { Button } from "@krakow-bez-barier/ui";
import { useLocale, useMessages } from "@/i18n/client";
import { routeSpeech } from "@/lib/route-speech";
import { useReadAloud } from "@/lib/use-read-aloud";

/** "Czytaj na głos": reads the step list with the browser's speech synthesis; hidden when the browser has none. */
export function ReadAloud({ route }: { route: Route }) {
  const m = useMessages();
  const t = m.route.speech;
  const locale = useLocale();
  const { supported, state, play, pause, resume, stop } = useReadAloud();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Another route (kind, profile, ends) is shown: what was being read no longer applies.
  useEffect(() => stop, [route, stop]);

  if (!supported) return null;

  const toggle = () => {
    if (state === "speaking") pause();
    else if (state === "paused") resume();
    else play(routeSpeech(m, route, locale));
  };

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      <Button ref={toggleRef} variant="outline" size="sm" onClick={toggle}>
        {state === "speaking" ? <Pause weight="bold" /> : state === "paused" ? <Play weight="bold" /> : <SpeakerHigh weight="bold" />}
        {state === "speaking" ? t.pause : state === "paused" ? t.resume : t.play}
      </Button>
      {state !== "idle" ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            stop();
            toggleRef.current?.focus();
          }}
        >
          <Stop weight="bold" />
          {t.stop}
        </Button>
      ) : null}
    </div>
  );
}
