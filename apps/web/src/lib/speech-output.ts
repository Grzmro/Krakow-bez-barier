/** The parts of the Web Speech API's `speechSynthesis` we use. */
export interface SpeechSynthesisLike {
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  getVoices(): { lang: string }[];
}

export interface UtteranceLike {
  lang: string;
  voice: unknown;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

export type UtteranceCtor = new (text: string) => UtteranceLike;

export type SpeechOutputWindow = {
  speechSynthesis?: SpeechSynthesisLike;
  SpeechSynthesisUtterance?: UtteranceCtor;
};

export type ReaderState = "idle" | "speaking" | "paused";

/** The browser's speech synthesis, or null without one (Firefox with speech off, Android WebView). */
export function speechSynthesisFor(win: SpeechOutputWindow | undefined) {
  if (!win?.speechSynthesis || !win.SpeechSynthesisUtterance) return null;
  return { synth: win.speechSynthesis, Utterance: win.SpeechSynthesisUtterance };
}

/** A voice for the language (`pl-PL` → any `pl` voice); null lets the browser pick by `lang`. */
export function voiceFor<V extends { lang: string }>(voices: V[], lang: string): V | null {
  const exact = voices.find((voice) => voice.lang.replace("_", "-").toLowerCase() === lang.toLowerCase());
  if (exact) return exact;
  const prefix = lang.split("-")[0].toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix)) ?? null;
}

/**
 * Reads texts one utterance each. Pause cancels and remembers the text being read, resume starts from it again:
 * `speechSynthesis.pause()` is unreliable (Chrome on Android ignores it, long pauses drop the queue).
 */
export function createReader(
  { synth, Utterance }: { synth: SpeechSynthesisLike; Utterance: UtteranceCtor },
  onState: (state: ReaderState) => void,
) {
  let texts: string[] = [];
  let lang = "";
  let position = 0;
  let run = 0;
  let state: ReaderState = "idle";
  // Chrome drops the events of utterances nothing references, so the queue is kept here.
  let queue: UtteranceLike[] = [];

  const set = (next: ReaderState) => {
    if (state === next) return;
    state = next;
    onState(next);
  };

  const speakFrom = (start: number) => {
    const current = ++run;
    synth.cancel();
    const voice = voiceFor(synth.getVoices(), lang);
    queue = texts.slice(start).map((text, offset) => {
      const utterance = new Utterance(text);
      utterance.lang = lang;
      if (voice) utterance.voice = voice;
      const index = start + offset;
      utterance.onstart = () => {
        if (current === run) position = index;
      };
      const finish = () => {
        if (current !== run || index !== texts.length - 1) return;
        position = 0;
        queue = [];
        set("idle");
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      return utterance;
    });
    position = start;
    set("speaking");
    for (const utterance of queue) synth.speak(utterance);
  };

  const halt = () => {
    run++;
    queue = [];
    synth.cancel();
  };

  return {
    play(next: string[], nextLang: string) {
      if (!next.length) return;
      texts = next;
      lang = nextLang;
      speakFrom(0);
    },
    pause() {
      if (state !== "speaking") return;
      halt();
      set("paused");
    },
    resume() {
      if (state !== "paused") return;
      speakFrom(position);
    },
    stop() {
      halt();
      position = 0;
      set("idle");
    },
  };
}
