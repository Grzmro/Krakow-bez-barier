"use client";

import { useEffect } from "react";
import { Microphone, Stop } from "@phosphor-icons/react";
import { cn, toast, useAnnounce } from "@krakow-bez-barier/ui";
import { useMessages } from "@/i18n/client";
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
      toast.error(t.errors[error]);
      announce(t.errors[error]);
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
        "grid size-10 place-items-center rounded-full",
        active ? "bg-primary text-primary-foreground motion-safe:animate-pulse" : "hover:bg-muted",
        className,
      )}
    >
      {active ? <Stop weight="fill" className="size-5" aria-hidden /> : <Microphone weight="bold" className="size-5" aria-hidden />}
    </button>
  );
}
