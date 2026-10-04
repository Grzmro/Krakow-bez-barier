"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowCounterClockwise, CaretLeft, CaretRight, Play, SpeakerHigh, Stop, X } from "@phosphor-icons/react";
import type { Route } from "@krakow-bez-barier/contracts";
import { Button, reducedMotion, useAnnounce } from "@krakow-bez-barier/ui";
import { useLocale, useMessages } from "@/i18n/client";
import { routeSpeech, segmentSpeech } from "@/lib/route-speech";
import { scrollIntoViewWithin } from "@/lib/scroll-within";
import { useReadAloud } from "@/lib/use-read-aloud";

/**
 * "Czytaj na głos" in the route preview: one step at a time — Poprzedni / Powtórz / Następny say a step and highlight it
 * in the list (`reading`). The whole route is read only on "Przeczytaj całą trasę", and that can be stopped. Every
 * utterance starts from a tap, which is what iOS needs. Hidden when the browser has no speech synthesis.
 */
export function ReadAloud({
  route,
  reading,
  onReading,
  stepRefs,
}: {
  route: Route;
  /** Index of the step being read, highlighted in the list; null when reading is off. */
  reading: number | null;
  onReading: (index: number | null) => void;
  stepRefs: RefObject<Map<number, HTMLButtonElement>>;
}) {
  const m = useMessages();
  const t = m.route.speech;
  const locale = useLocale();
  const announce = useAnnounce();
  const total = route.segments.length;
  const [whole, setWhole] = useState(false);
  const [noVoice, setNoVoice] = useState(false);

  const show = (index: number) => {
    onReading(index);
    const step = stepRefs.current.get(route.segments[index]?.id);
    // The controls stay on top of the list while it scrolls (focus is on them); the step must clear them.
    if (step) scrollIntoViewWithin(step, reducedMotion() ? "auto" : "smooth", controls.current?.offsetHeight ?? 0);
  };
  // While the whole route is read, the highlight follows the step being said; it stays there when reading stops.
  const wholeFrom = useRef<number | null>(null);
  const { supported, state, play, say, stop } = useReadAloud((index) => {
    if (wholeFrom.current !== null) show(wholeFrom.current + index);
  });
  const readingAll = whole && state === "speaking";

  const playButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const repeatButton = useRef<HTMLButtonElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const opened = reading !== null;
  const wasOpen = useRef(opened);
  useEffect(() => {
    if (opened && !wasOpen.current) (total > 1 ? nextButton : repeatButton).current?.focus();
    else if (!opened && wasOpen.current) playButton.current?.focus();
    wasOpen.current = opened;
  }, [opened, total]);

  // Another route (kind, profile, ends) is shown: what was being read no longer applies.
  useEffect(
    () => () => {
      stop();
      onReading(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new route resets the reader
    [route, stop],
  );

  if (!supported) return null;

  const spoken = (ok: boolean) => {
    setNoVoice(!ok);
    if (!ok) announce(t.noVoice);
    return ok;
  };
  const readingWhole = (from: number | null) => {
    wholeFrom.current = from;
    setWhole(from !== null);
  };
  const readStep = (index: number) => {
    readingWhole(null);
    if (!spoken(say(segmentSpeech(m, route.segments[index], index, total, locale)))) return;
    show(index);
    // At the first or last step the button just pressed turns disabled; focus would drop to the page.
    const active = document.activeElement;
    if ((index === 0 || index === total - 1) && active instanceof HTMLButtonElement && active !== repeatButton.current && controls.current?.contains(active)) {
      repeatButton.current?.focus();
    }
  };
  const readAll = () => {
    const from = reading ?? 0;
    readingWhole(from);
    if (!spoken(play(routeSpeech(m, route, locale).slice(from)))) readingWhole(null);
  };
  const close = () => {
    stop();
    readingWhole(null);
    onReading(null);
  };

  if (reading === null) {
    return (
      <div className="mb-2">
        <Button ref={playButton} variant="outline" size="sm" onClick={() => readStep(0)}>
          <SpeakerHigh weight="bold" />
          {t.play}
        </Button>
        {noVoice ? <p className="mt-2 text-body-sm text-muted-foreground">{t.noVoice}</p> : null}
      </div>
    );
  }

  return (
    <div
      ref={controls}
      role="group"
      aria-label={t.controls}
      className="sticky top-0 z-10 mb-3 grid gap-2 rounded-[20px] bg-surface-raised p-3 shadow-soft ring-1 ring-border/70"
    >
      <div className="-mt-1 -mr-1 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-caption font-semibold text-muted-foreground">{t.reading(reading + 1, total)}</p>
        <Button variant="ghost" size="icon" aria-label={t.close} onClick={close} className="size-10 shrink-0">
          <X weight="bold" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" className="h-auto min-h-10 whitespace-normal" disabled={reading === 0} onClick={() => readStep(reading - 1)}>
          <CaretLeft weight="bold" />
          {t.previous}
        </Button>
        <Button ref={repeatButton} variant="outline" size="sm" className="h-auto min-h-10 whitespace-normal" onClick={() => readStep(reading)}>
          <ArrowCounterClockwise weight="bold" />
          {t.repeat}
        </Button>
        <Button
          ref={nextButton}
          variant="outline"
          size="sm"
          className="h-auto min-h-10 whitespace-normal"
          disabled={reading >= total - 1}
          onClick={() => readStep(reading + 1)}
        >
          {t.next}
          <CaretRight weight="bold" />
        </Button>
      </div>
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!readingAll) return readAll();
            stop();
            readingWhole(null);
          }}
        >
          {readingAll ? <Stop weight="bold" /> : <Play weight="bold" />}
          {readingAll ? t.stop : t.all}
        </Button>
      </div>
      {noVoice ? <p className="text-body-sm text-muted-foreground">{t.noVoice}</p> : null}
    </div>
  );
}
