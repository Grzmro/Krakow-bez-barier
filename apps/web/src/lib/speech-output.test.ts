import { describe, expect, it } from "vitest";
import { createReader, speechSynthesisFor, voiceFor, type ReaderState, type UtteranceLike } from "./speech-output";

class FakeUtterance implements UtteranceLike {
  lang = "";
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}

function fakeSynth(voices: { lang: string }[] = []) {
  const queue: FakeUtterance[] = [];
  const synth = {
    spoken: [] as string[],
    speak(u: UtteranceLike) {
      queue.push(u as FakeUtterance);
    },
    cancel() {
      const dropped = queue.splice(0);
      for (const u of dropped) u.onerror?.();
    },
    getVoices: () => voices,
    /** Plays the next queued utterance to its end. */
    next() {
      const u = queue.shift();
      if (!u) return;
      u.onstart?.();
      synth.spoken.push(u.text);
      u.onend?.();
    },
    /** Starts the next utterance without finishing it. */
    begin() {
      queue[0]?.onstart?.();
    },
    queue,
  };
  return synth;
}

function setup(voices: { lang: string }[] = []) {
  const synth = fakeSynth(voices);
  const states: ReaderState[] = [];
  const reader = createReader({ synth, Utterance: FakeUtterance }, (state) => states.push(state));
  return { synth, states, reader };
}

describe("speechSynthesisFor", () => {
  it("is null without the Web Speech synthesis", () => {
    // GIVEN windows without synthesis or without utterances
    // WHEN / THEN the reader is not offered
    expect(speechSynthesisFor(undefined)).toBeNull();
    expect(speechSynthesisFor({})).toBeNull();
    expect(speechSynthesisFor({ speechSynthesis: fakeSynth() })).toBeNull();
    expect(speechSynthesisFor({ speechSynthesis: fakeSynth(), SpeechSynthesisUtterance: FakeUtterance })).not.toBeNull();
  });
});

describe("voiceFor", () => {
  it("prefers the exact language, then any voice of it", () => {
    // GIVEN voices in several languages
    const voices = [{ lang: "en-US" }, { lang: "pl_PL" }, { lang: "en-GB" }];

    // WHEN / THEN
    expect(voiceFor(voices, "en-GB")).toBe(voices[2]);
    expect(voiceFor(voices, "pl-PL")).toBe(voices[1]);
    expect(voiceFor([{ lang: "en-US" }], "pl-PL")).toBeNull();
  });
});

describe("createReader", () => {
  it("reads every text in the language and goes idle at the end", () => {
    // GIVEN a reader with a Polish voice
    const { synth, states, reader } = setup([{ lang: "pl-PL" }]);

    // WHEN two texts are played to the end
    reader.play(["Krok 1", "Krok 2"], "pl-PL");
    expect(synth.queue.every((u) => u.lang === "pl-PL" && u.voice !== null)).toBe(true);
    synth.next();
    synth.next();

    // THEN both were spoken and the reader is idle again
    expect(synth.spoken).toEqual(["Krok 1", "Krok 2"]);
    expect(states).toEqual(["speaking", "idle"]);
  });

  it("reports the text being read, so its step can be highlighted", () => {
    // GIVEN a reader that reports positions
    const synth = fakeSynth();
    const positions: number[] = [];
    const reader = createReader({ synth, Utterance: FakeUtterance }, () => {}, (index) => positions.push(index));

    // WHEN three texts are played and the second one starts
    reader.play(["Krok 1", "Krok 2", "Krok 3"], "pl-PL");
    synth.next();
    synth.begin();

    // THEN the positions follow the reading
    expect(positions).toEqual([0, 0, 1]);
  });

  it("cancels what it was saying when a new message comes, without ending the new one", () => {
    // GIVEN a reader in the middle of a message
    const { synth, states, reader } = setup();
    reader.play(["Za 50 metrów: skręć w prawo."], "pl-PL");
    synth.begin();

    // WHEN a new message is played (the cancel fires the old one's error event)
    reader.play(["Teraz skręć w prawo."], "pl-PL");

    // THEN only the new message is queued and the reader is still speaking
    expect(synth.queue.map((u) => u.text)).toEqual(["Teraz skręć w prawo."]);
    expect(states).toEqual(["speaking"]);
  });

  it("has a voice when one matches the language or none are loaded yet, not when only others exist", () => {
    // GIVEN devices with a Polish voice, only English voices, and voices still loading
    // WHEN / THEN Polish is read only where it won't come out in an English voice
    expect(setup([{ lang: "pl-PL" }]).reader.hasVoice("pl-PL")).toBe(true);
    expect(setup([{ lang: "en-US" }]).reader.hasVoice("pl-PL")).toBe(false);
    expect(setup([]).reader.hasVoice("pl-PL")).toBe(true);
  });

  it("stops and starts over from the first text", () => {
    // GIVEN a reader that read one text
    const { synth, states, reader } = setup();
    reader.play(["Krok 1", "Krok 2"], "en-GB");
    synth.next();

    // WHEN it is stopped and played again
    reader.stop();
    expect(synth.queue).toHaveLength(0);
    reader.play(["Krok 1", "Krok 2"], "en-GB");

    // THEN it starts from the first text
    expect(states).toEqual(["speaking", "idle", "speaking"]);
    expect(synth.queue.map((u) => u.text)).toEqual(["Krok 1", "Krok 2"]);
  });

  it("goes idle when the browser refuses to speak", () => {
    // GIVEN a reader whose utterances all fail (e.g. iOS without a tap)
    const { synth, states, reader } = setup();
    reader.play(["Krok 1", "Krok 2"], "pl-PL");

    // WHEN every utterance errors
    for (const u of synth.queue.splice(0)) u.onerror?.();

    // THEN the reader is idle, not stuck speaking
    expect(states).toEqual(["speaking", "idle"]);
  });
});
