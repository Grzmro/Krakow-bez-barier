"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/i18n/client";
import { speechLang } from "./speech-input";
import { createReader, speechSynthesisFor, type ReaderState, type SpeechOutputWindow } from "./speech-output";

const noSubscribe = () => () => {};
const engine = () => speechSynthesisFor(window as unknown as SpeechOutputWindow);
const detect = () => engine() !== null;

/**
 * Reads texts aloud with the browser's speech synthesis, in the app's language; nothing leaves the device.
 * `play` and `say` return false (and say nothing) when the device has no voice for the language.
 * The first call must come from a tap: iOS keeps synthesis silent until then.
 */
export function useReadAloud(onPosition?: (index: number) => void) {
  const locale = useLocale();
  const supported = useSyncExternalStore(noSubscribe, detect, () => false);
  const [state, setState] = useState<ReaderState>("idle");
  const reader = useRef<ReturnType<typeof createReader> | null>(null);
  const positionRef = useRef(onPosition);
  useEffect(() => {
    positionRef.current = onPosition;
  });

  const get = useCallback(() => {
    if (!reader.current) {
      const found = engine();
      if (found) reader.current = createReader(found, setState, (index) => positionRef.current?.(index));
    }
    return reader.current;
  }, []);

  // Stops on unmount and when the language changes mid-read.
  useEffect(() => () => reader.current?.stop(), [locale]);

  const play = useCallback(
    (texts: string[]) => {
      const current = get();
      const lang = speechLang(locale);
      if (!current?.hasVoice(lang)) return false;
      current.play(texts, lang);
      return true;
    },
    [get, locale],
  );
  const say = useCallback((text: string) => play([text]), [play]);
  const stop = useCallback(() => reader.current?.stop(), []);

  return { supported, state, play, say, stop };
}
