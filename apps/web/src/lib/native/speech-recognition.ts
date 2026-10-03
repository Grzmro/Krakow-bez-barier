import { SpeechRecognition as NativeSpeech } from "@capacitor-community/speech-recognition";
import type { PluginListenerHandle } from "@capacitor/core";
import type { SpeechRecognitionLike, SpeechResultEventLike } from "../speech-input";

/**
 * `SpeechRecognition` backed by the Android recognizer: the Android WebView has no Web Speech API, and the plugin
 * also asks for RECORD_AUDIO at runtime. Same surface as the browser object, so `startSpeech` needs no changes.
 */
export class NativeSpeechRecognition implements SpeechRecognitionLike {
  lang = "pl-PL";
  interimResults = true;
  continuous = false;
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  onresult: ((event: SpeechResultEventLike) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  private text = "";
  private ended = false;
  private handles: Promise<PluginListenerHandle>[] = [];

  start() {
    void this.run();
  }

  stop() {
    void NativeSpeech.stop().catch(() => {});
  }

  abort() {
    this.ended = true;
    this.release();
    void NativeSpeech.stop().catch(() => {});
  }

  private async run() {
    try {
      const { available } = await NativeSpeech.available();
      if (!available) return this.fail("service-not-allowed");
      const permission = await NativeSpeech.requestPermissions();
      if (permission.speechRecognition !== "granted") return this.fail("not-allowed");
      this.handles = [
        NativeSpeech.addListener("partialResults", ({ matches }) => {
          this.text = matches?.[0] ?? this.text;
          this.emit(false);
        }),
        NativeSpeech.addListener("listeningState", ({ status }) => {
          if (status === "started") this.onstart?.();
          else this.finish();
        }),
      ];
      await Promise.all(this.handles);
      await NativeSpeech.start({ language: this.lang, maxResults: 1, partialResults: true, popup: false });
    } catch (error) {
      this.fail(failureCode(error));
    }
  }

  private emit(final: boolean) {
    if (this.ended || !this.text) return;
    this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: this.text }], { isFinal: final })] });
  }

  private finish() {
    if (this.ended) return;
    this.onspeechend?.();
    this.emit(true);
    this.ended = true;
    this.release();
    this.onend?.();
  }

  private fail(code: string) {
    if (this.ended) return;
    this.ended = true;
    this.release();
    this.onerror?.({ error: code });
  }

  private release() {
    const handles = this.handles;
    this.handles = [];
    for (const handle of handles) void handle.then((h) => h.remove()).catch(() => {});
  }
}

/** Maps a plugin rejection to a Web Speech error code; the plugin reports permission and network problems by message. */
export function failureCode(error: unknown): string {
  const message = (typeof error === "object" && error && "message" in error ? String(error.message) : "").toLowerCase();
  if (message.includes("permission") || message.includes("denied")) return "not-allowed";
  if (message.includes("network")) return "network";
  if (message.includes("no match") || message.includes("speech timeout")) return "no-speech";
  return "other";
}
