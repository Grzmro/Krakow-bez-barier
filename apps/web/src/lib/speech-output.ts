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

export type ReaderState = "idle" | "speaking";

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
 * Reads texts one utterance each; every `play` cancels what was being said first, so a new message never talks over an
 * old one. `onPosition` gets the index of the text being read (for highlighting a step). There is no pause:
 * `speechSynthesis.pause()` is unreliable (Chrome on Android ignores it, Safari sometimes never resumes), so the caller
 * keeps the index and plays from it again.
 */
export function createReader(
  { synth, Utterance }: { synth: SpeechSynthesisLike; Utterance: UtteranceCtor },
  onState: (state: ReaderState) => void,
  onPosition: (index: number) => void = () => {},
) {
  let run = 0;
  let state: ReaderState = "idle";
  // Chrome drops the events of utterances nothing references, so the queue is kept here.
  let queue: UtteranceLike[] = [];

  const set = (next: ReaderState) => {
    if (state === next) return;
    state = next;
    onState(next);
  };

  const halt = () => {
    run++;
    queue = [];
    synth.cancel();
  };

  return {
    /**
     * False when the device has voices but none in `lang`: a Polish text read by an English voice is worse than
     * silence. No voices at all (still loading — `getVoices()` fills in late, iOS may never say so) lets the browser
     * pick by `lang`.
     */
    hasVoice(lang: string) {
      const voices = synth.getVoices();
      return !voices.length || voiceFor(voices, lang) !== null;
    },
    play(texts: string[], lang: string) {
      halt();
      if (!texts.length) return set("idle");
      const current = run;
      const voice = voiceFor(synth.getVoices(), lang);
      queue = texts.map((text, index) => {
        const utterance = new Utterance(text);
        utterance.lang = lang;
        if (voice) utterance.voice = voice;
        utterance.onstart = () => {
          if (current === run) onPosition(index);
        };
        // `cancel()` ends utterances with an error event ("canceled"/"interrupted"); only the current run's last one
        // finishes the reading, and an error is no reason to show anything.
        const finish = () => {
          if (current !== run || index !== texts.length - 1) return;
          queue = [];
          set("idle");
        };
        utterance.onend = finish;
        utterance.onerror = finish;
        return utterance;
      });
      onPosition(0);
      set("speaking");
      for (const utterance of queue) synth.speak(utterance);
    },
    stop() {
      halt();
      set("idle");
    },
  };
}
