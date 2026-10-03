"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/i18n/client";
import { speechLang } from "./speech-input";
import { createReader, speechSynthesisFor, type ReaderState, type SpeechOutputWindow } from "./speech-output";

const noSubscribe = () => () => {};
const engine = () => speechSynthesisFor(window as unknown as SpeechOutputWindow);
const detect = () => engine() !== null;

/** Reads texts aloud with the browser's speech synthesis, in the app's language; nothing leaves the device. */
export function useReadAloud() {
  const locale = useLocale();
  const supported = useSyncExternalStore(noSubscribe, detect, () => false);
  const [state, setState] = useState<ReaderState>("idle");
  const reader = useRef<ReturnType<typeof createReader> | null>(null);

  const get = useCallback(() => {
    if (!reader.current) {
      const found = engine();
      if (found) reader.current = createReader(found, setState);
    }
    return reader.current;
  }, []);

  // Stops on unmount and when the language changes mid-read.
  useEffect(() => () => reader.current?.stop(), [locale]);

  const play = useCallback((texts: string[]) => get()?.play(texts, speechLang(locale)), [get, locale]);
  const pause = useCallback(() => reader.current?.pause(), []);
  const resume = useCallback(() => reader.current?.resume(), []);
  const stop = useCallback(() => reader.current?.stop(), []);

  return { supported, state, play, pause, resume, stop };
}
