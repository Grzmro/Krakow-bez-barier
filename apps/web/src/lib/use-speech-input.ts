"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/i18n/client";
import { appPlatform } from "./native/platform";
import { NativeSpeechRecognition } from "./native/speech-recognition";
import { speechLang, speechRecognitionFor, startSpeech, type SpeechError, type SpeechState, type SpeechWindow } from "./speech-input";

const noSubscribe = () => () => {};
// The Android WebView has no Web Speech API, so the native app uses the Android recognizer.
const recognizer = () =>
  appPlatform() === "android" ? NativeSpeechRecognition : speechRecognitionFor(window as unknown as SpeechWindow);
const detect = () => recognizer() !== null;

/** Dictation into a text field with the browser's Web Speech API, in the app's language. */
export function useSpeechInput(onText: (text: string, final: boolean) => void) {
  const locale = useLocale();
  const supported = useSyncExternalStore(noSubscribe, detect, () => false);
  const [state, setState] = useState<SpeechState>("idle");
  const [error, setError] = useState<SpeechError | null>(null);
  const session = useRef<ReturnType<typeof startSpeech> | null>(null);
  const textRef = useRef(onText);
  useEffect(() => {
    textRef.current = onText;
  }, [onText]);
  useEffect(() => () => session.current?.cancel(), []);

  const start = useCallback(() => {
    const Ctor = recognizer();
    if (!Ctor) return;
    session.current?.cancel();
    setError(null);
    setState("listening");
    session.current = startSpeech(Ctor, speechLang(locale), {
      onState: (next, reason) => {
        setState(next);
        setError(reason ?? null);
        if (next === "idle" || next === "error") session.current = null;
      },
      onText: (text, final) => textRef.current(text, final),
    });
  }, [locale]);

  const stop = useCallback(() => session.current?.stop(), []);
  const active = state === "listening" || state === "processing";
  const toggle = useCallback(() => (active ? stop() : start()), [active, start, stop]);

  return { supported, state, error, active, start, stop, toggle };
}
