import type { Page } from "@playwright/test";

export type Spoken = { text: string; lang: string };

/**
 * Replaces speechSynthesis with a recorder: headless Chromium has no voices, and a test must hear what would be said.
 * The first queued utterance starts, nothing ends by itself; `cancel()` drops the queue with error events, as browsers do.
 */
export async function fakeSpeech(page: Page, voices: { lang: string }[] = []) {
  await page.addInitScript((voiceList) => {
    type Utterance = { text: string; lang: string; onstart?: () => void; onend?: () => void; onerror?: () => void };
    const log: { text: string; lang: string }[] = [];
    let queue: Utterance[] = [];
    Object.defineProperties(window, {
      __spoken: { value: log },
      SpeechSynthesisUtterance: {
        value: class {
          lang = "";
          voice = null;
          constructor(readonly text: string) {}
        },
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak(u: Utterance) {
          log.push({ text: u.text, lang: u.lang });
          queue.push(u);
          if (queue.length === 1) u.onstart?.();
        },
        cancel() {
          const dropped = queue;
          queue = [];
          for (const u of dropped) u.onerror?.();
        },
        getVoices: () => voiceList,
      },
    });
  }, voices);
}

/** Everything said so far, in order. */
export const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: Spoken[] }).__spoken);
