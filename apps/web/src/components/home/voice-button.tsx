"use client";

import { useEffect } from "react";
import { Microphone, Stop } from "@phosphor-icons/react";
import { cn, toast, useAnnounce } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
import { appPlatform } from "@/lib/native/platform";
import type { useSpeechInput } from "@/lib/use-speech-input";

const NOTICE_KEY = "kbb-voice-notice";

function noticeSeen() {
  try {
    return localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}

function markNoticeSeen() {
  try {
    localStorage.setItem(NOTICE_KEY, "1");
  } catch {
    // Storage blocked: the notice shows again next time, which is harmless.
  }
}

/** Microphone toggle for a field: dictation state is announced, errors shown as a toast. */
export function VoiceButton({ speech, className }: { speech: ReturnType<typeof useSpeechInput>; className?: string }) {
  const t = useMessages().home.search.voice;
  const announce = useAnnounce();
  const { state, error, active, toggle } = speech;

  useEffect(() => {
    if (state === "listening") announce(t.listening);
    else if (state === "processing") announce(t.processing);
    else if (state === "error" && error) {
      const message = error === "not-allowed" && appPlatform() === "android" ? t.notAllowedApp : t.errors[error];
      toast.error(message);
      announce(message);
    }
  }, [announce, error, state, t]);

  const press = () => {
    if (!active && !noticeSeen()) {
      markNoticeSeen();
      toast(t.notice, { duration: 10_000 });
    }
    toggle();
  };

  return (
    <button
      type="button"
      aria-label={t.start}
      aria-pressed={active}
      onClick={press}
      className={cn(
        "relative grid size-10 place-items-center rounded-full",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
        className,
      )}
    >
      {active ? <span aria-hidden className="absolute inset-0 rounded-full bg-primary/40 motion-safe:animate-ping" /> : null}
      {active ? <Stop weight="fill" className="relative size-5" aria-hidden /> : <Microphone weight="bold" className="size-5" aria-hidden />}
    </button>
  );
}
