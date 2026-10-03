import { beforeEach, describe, expect, it, vi } from "vitest";

const available = vi.fn();
const requestPermissions = vi.fn();
const start = vi.fn();
const stop = vi.fn();
const listeners: Record<string, (data: never) => void> = {};
const addListener = vi.fn();

vi.mock("@capacitor-community/speech-recognition", () => ({
  SpeechRecognition: { available, requestPermissions, start, stop, addListener },
}));

const { NativeSpeechRecognition, failureCode } = await import("./speech-recognition");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.resetAllMocks();
  addListener.mockImplementation(async (name: string, fn: (data: never) => void) => {
    listeners[name] = fn;
    return { remove: vi.fn() };
  });
  stop.mockResolvedValue(undefined);
  available.mockResolvedValue({ available: true });
  start.mockResolvedValue({});
});

describe("NativeSpeechRecognition", () => {
  it("reports not-allowed and never starts when the microphone is refused", async () => {
    // GIVEN the user denies the system microphone prompt
    requestPermissions.mockResolvedValue({ speechRecognition: "denied" });
    const recognition = new NativeSpeechRecognition();
    const onerror = vi.fn();
    recognition.onerror = onerror;

    // WHEN dictation starts
    recognition.start();
    await tick();

    // THEN the error is not-allowed and the recognizer was not started
    expect(onerror).toHaveBeenCalledWith({ error: "not-allowed" });
    expect(start).not.toHaveBeenCalled();
  });

  it("streams partial text and settles it as final when listening stops", async () => {
    // GIVEN the microphone is granted
    requestPermissions.mockResolvedValue({ speechRecognition: "granted" });
    const recognition = new NativeSpeechRecognition();
    recognition.lang = "pl-PL";
    const texts: [string, boolean][] = [];
    recognition.onresult = (event) => texts.push([event.results[0][0].transcript, event.results[0].isFinal]);
    const onend = vi.fn();
    recognition.onend = onend;

    // WHEN the user speaks and the recognizer stops
    recognition.start();
    await tick();
    listeners.partialResults({ matches: ["najbliższa toaleta"] } as never);
    listeners.listeningState({ status: "stopped" } as never);

    // THEN the text arrives interim, then final, and the session ends once
    expect(start).toHaveBeenCalledWith({ language: "pl-PL", maxResults: 1, partialResults: true, popup: false });
    expect(texts).toEqual([
      ["najbliższa toaleta", false],
      ["najbliższa toaleta", true],
    ]);
    expect(onend).toHaveBeenCalledTimes(1);
  });

  it("maps plugin failures to Web Speech error codes", () => {
    // GIVEN plugin rejections / WHEN mapped / THEN Web Speech codes
    expect(failureCode(new Error("Missing permission"))).toBe("not-allowed");
    expect(failureCode({ message: "Network error" })).toBe("network");
    expect(failureCode(new Error("boom"))).toBe("other");
  });
});
