import type { Locale } from "@/i18n/locale";

/** The part of the Web Speech API's `SpeechRecognition` we use; lib.dom doesn't type it. */
export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface SpeechResultEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export type SpeechState = "idle" | "listening" | "processing" | "error";
export type SpeechError = "not-allowed" | "no-speech" | "network" | "other";

export type SpeechWindow = {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  navigator: { userAgent: string; maxTouchPoints: number; standalone?: boolean };
  matchMedia?: (query: string) => { matches: boolean };
};

const IOS = /iPhone|iPad|iPod/;

function isIos({ userAgent, maxTouchPoints }: SpeechWindow["navigator"]) {
  // iPadOS reports itself as a Mac; touch points tell them apart.
  return IOS.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/**
 * The browser's speech recognizer, or null when dictation can't work: no Web Speech API (Firefox, the iOS app's
 * WebView) or an iOS home-screen PWA, where Safari exposes the API but recognition fails.
 */
export function speechRecognitionFor(win: SpeechWindow | undefined): SpeechRecognitionCtor | null {
  if (!win) return null;
  const ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
  if (!ctor) return null;
  const standalone = win.navigator.standalone === true || win.matchMedia?.("(display-mode: standalone)").matches === true;
  if (standalone && isIos(win.navigator)) return null;
  return ctor;
}

export const speechLang = (locale: Locale) => (locale === "en" ? "en-GB" : "pl-PL");

export function speechError(code: string): SpeechError {
  if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") return "not-allowed";
  if (code === "no-speech") return "no-speech";
  if (code === "network") return "network";
  return "other";
}

export interface SpeechCallbacks {
  onState: (state: SpeechState, error?: SpeechError) => void;
  /** The text heard so far; `final` once the recognizer settles on it. */
  onText: (text: string, final: boolean) => void;
}

/**
 * Starts one dictation: listens until a pause, reports the text and states. `stop()` ends it early and keeps what
 * was heard; `cancel()` drops it silently (unmount).
 */
export function startSpeech(Ctor: SpeechRecognitionCtor, lang: string, { onState, onText }: SpeechCallbacks) {
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let done = false;
  let heard = false;
  recognition.onstart = () => !done && onState("listening");
  recognition.onspeechend = () => !done && onState("processing");
  recognition.onresult = (event) => {
    if (done) return;
    let text = "";
    let final = true;
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      text += result[0]?.transcript ?? "";
      if (!result.isFinal) final = false;
    }
    text = text.trim();
    if (!text) return;
    heard = true;
    onText(text, final);
  };
  recognition.onerror = (event) => {
    if (done) return;
    done = true;
    onState("error", speechError(event.error));
  };
  recognition.onend = () => {
    if (done) return;
    done = true;
    if (heard) onState("idle");
    else onState("error", "no-speech");
  };
  try {
    recognition.start();
  } catch {
    done = true;
    onState("error", "other");
  }
  return {
    stop() {
      if (done) return;
      if (!heard) {
        done = true;
        recognition.abort();
        onState("idle");
      } else recognition.stop();
    },
    cancel() {
      done = true;
      recognition.abort();
    },
  };
}
