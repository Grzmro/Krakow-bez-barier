import { describe, expect, it, vi } from "vitest";
import {
  speechError,
  speechLang,
  speechRecognitionFor,
  startSpeech,
  type SpeechRecognitionLike,
  type SpeechResultEventLike,
  type SpeechWindow,
} from "./speech-input";

class FakeRecognition implements SpeechRecognitionLike {
  static last: FakeRecognition;
  lang = "";
  interimResults = false;
  continuous = true;
  maxAlternatives = 5;
  onstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  onresult: ((event: SpeechResultEventLike) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  aborted = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.aborted = true;
    this.onerror?.({ error: "aborted" });
    this.onend?.();
  }
  say(parts: [string, boolean][]) {
    const results = parts.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal }));
    this.onresult?.({ resultIndex: 0, results });
  }
}

const desktop = { userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/130", maxTouchPoints: 0 };
const iphone = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari", maxTouchPoints: 5 };

function run() {
  const onState = vi.fn();
  const onText = vi.fn();
  const session = startSpeech(FakeRecognition, "pl-PL", { onState, onText });
  return { onState, onText, session, recognition: FakeRecognition.last };
}

describe("speechRecognitionFor", () => {
  it("finds the standard or the webkit-prefixed recognizer", () => {
    // GIVEN browsers exposing one name or the other
    const standard: SpeechWindow = { SpeechRecognition: FakeRecognition, navigator: desktop };
    const webkit: SpeechWindow = { webkitSpeechRecognition: FakeRecognition, navigator: desktop };

    // WHEN / THEN
    expect(speechRecognitionFor(standard)).toBe(FakeRecognition);
    expect(speechRecognitionFor(webkit)).toBe(FakeRecognition);
  });

  it("returns null without the API, on the server and in an iOS home-screen app", () => {
    // GIVEN Firefox, no window, and Safari opened from the iOS home screen
    const firefox: SpeechWindow = { navigator: desktop };
    const iosPwa: SpeechWindow = { webkitSpeechRecognition: FakeRecognition, navigator: { ...iphone, standalone: true } };
    const iosSafari: SpeechWindow = { webkitSpeechRecognition: FakeRecognition, navigator: iphone };

    // WHEN / THEN the button hides instead of failing; plain iOS Safari keeps it
    expect(speechRecognitionFor(firefox)).toBeNull();
    expect(speechRecognitionFor(undefined)).toBeNull();
    expect(speechRecognitionFor(iosPwa)).toBeNull();
    expect(speechRecognitionFor(iosSafari)).toBe(FakeRecognition);
  });
});

describe("speechLang / speechError", () => {
  it("maps the app language and browser error codes", () => {
    expect(speechLang("pl")).toBe("pl-PL");
    expect(speechLang("en")).toBe("en-GB");
    expect(speechError("not-allowed")).toBe("not-allowed");
    expect(speechError("service-not-allowed")).toBe("not-allowed");
    expect(speechError("audio-capture")).toBe("not-allowed");
    expect(speechError("no-speech")).toBe("no-speech");
    expect(speechError("network")).toBe("network");
    expect(speechError("language-not-supported")).toBe("other");
  });
});

describe("startSpeech", () => {
  it("configures one short dictation in the given language", () => {
    // WHEN
    const { recognition } = run();

    // THEN
    expect(recognition.started).toBe(true);
    expect(recognition.lang).toBe("pl-PL");
    expect(recognition.interimResults).toBe(true);
    expect(recognition.continuous).toBe(false);
    expect(recognition.maxAlternatives).toBe(1);
  });

  it("reports listening, interim and final text, processing, then idle", () => {
    // GIVEN
    const { onState, onText, recognition } = run();

    // WHEN the user speaks and pauses
    recognition.onstart?.();
    recognition.say([["muzeum", false]]);
    recognition.onspeechend?.();
    recognition.say([["muzeum ", true], ["z windą", true]]);
    recognition.onend?.();

    // THEN
    expect(onText.mock.calls).toEqual([
      ["muzeum", false],
      ["muzeum z windą", true],
    ]);
    expect(onState.mock.calls).toEqual([["listening"], ["processing"], ["idle"]]);
  });

  it("maps a browser error once and ignores the end that follows", () => {
    // GIVEN
    const { onState, recognition } = run();

    // WHEN the microphone is blocked
    recognition.onerror?.({ error: "not-allowed" });
    recognition.onend?.();

    // THEN
    expect(onState.mock.calls).toEqual([["error", "not-allowed"]]);
  });

  it("treats an end without any text as no speech", () => {
    // GIVEN
    const { onState, recognition } = run();

    // WHEN
    recognition.onstart?.();
    recognition.onend?.();

    // THEN
    expect(onState).toHaveBeenLastCalledWith("error", "no-speech");
  });

  it("stops quietly when the user stops before speaking", () => {
    // GIVEN
    const { onState, session, recognition } = run();
    recognition.onstart?.();

    // WHEN
    session.stop();

    // THEN no error, back to idle
    expect(recognition.aborted).toBe(true);
    expect(onState.mock.calls).toEqual([["listening"], ["idle"]]);
  });

  it("keeps the text when the user stops after speaking", () => {
    // GIVEN
    const { onState, onText, session, recognition } = run();
    recognition.say([["Wawel", false]]);

    // WHEN
    session.stop();

    // THEN
    expect(onText).toHaveBeenCalledWith("Wawel", false);
    expect(onState).toHaveBeenLastCalledWith("idle");
  });

  it("drops everything after cancel", () => {
    // GIVEN
    const { onState, onText, session, recognition } = run();

    // WHEN the field unmounts mid-dictation
    session.cancel();
    recognition.say([["Wawel", true]]);
    recognition.onend?.();

    // THEN
    expect(onText).not.toHaveBeenCalled();
    expect(onState).not.toHaveBeenCalled();
  });
});
