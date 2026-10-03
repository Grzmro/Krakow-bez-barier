import type { FeedData, TransitFeedProvider } from "./feed";

/** A snapshot of the operator's feeds written by `scripts/record-transit-fixture.ts`, cut to the city centre. */
export type TransitRecording = {
  recordedAt: string;
  feeds: Record<string, Omit<FeedData, "feed">>;
};

// Loaded on first use, so a server that reads the live feed doesn't carry the recording.
const demoRecording = () =>
  import("./fixtures/ztp-2026-10-03.json").then((m) => m.default as unknown as TransitRecording);

/**
 * Answers from a recording instead of the operator: for tests and e2e (no network). Its departures are those due
 * after the recording's time, and the API labels them `recorded`, never live.
 */
export function createRecordedProvider(recording: TransitRecording | (() => Promise<TransitRecording>) = demoRecording): TransitFeedProvider {
  return {
    kind: "recorded",
    async load(feed) {
      const recorded = typeof recording === "function" ? await recording() : recording;
      const data = recorded.feeds[feed.id];
      if (!data) throw new Error(`no recording of feed ${feed.id}`);
      return { ...data, feed };
    },
  };
}
