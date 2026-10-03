import type { MappedPlace, SourceAdapter, SourceMeta } from "./adapter";
import type { CityConfig } from "./cities/types";

export type RunStatus = "ok" | "partial" | "failed";

export type RunSummary = {
  status: RunStatus;
  recordsSeen: number;
  recordsWritten: number;
  recordsSkipped: number;
  error: string | null;
};

/** Everything the runner needs from storage; the Drizzle implementation lives in store.ts. */
export interface IngestStore {
  upsertSource(meta: SourceMeta): Promise<void>;
  startRun(sourceId: string): Promise<string>;
  finishRun(runId: string, summary: RunSummary): Promise<void>;
  /** Number of facts inserted or superseded (refreshing an unchanged fact doesn't count). */
  applyPlace(meta: SourceMeta, place: MappedPlace, fetchedAt: Date): Promise<number>;
  markSource(sourceId: string, outcome: { ok: true } | { ok: false; error: string }, at: Date): Promise<void>;
}

export type RunOptions = {
  adapter: SourceAdapter<never>;
  city: CityConfig;
  store: IngestStore;
  userAgent: string;
  now?: () => Date;
  log?: (message: string) => void;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Fetches, maps and stores one source for one city. A failed fetch writes nothing but the run
 * row and the source status — previous facts stay as they are.
 */
export async function runIngest(options: RunOptions): Promise<RunSummary> {
  const { adapter, city, store, userAgent } = options;
  const now = options.now ?? (() => new Date());
  const log = options.log ?? (() => {});
  const { meta } = adapter;

  await store.upsertSource(meta);
  const runId = await store.startRun(meta.id);
  const startedAt = now();

  const fail = async (error: string, seen = 0): Promise<RunSummary> => {
    const summary: RunSummary = {
      status: "failed",
      recordsSeen: seen,
      recordsWritten: 0,
      recordsSkipped: 0,
      error,
    };
    await store.finishRun(runId, summary);
    await store.markSource(meta.id, { ok: false, error }, now());
    return summary;
  };

  try {
    const raw = await adapter.fetch({ city, userAgent });
    if (!Array.isArray(raw) || raw.length === 0) return await fail("Source returned no records");

    let written = 0;
    let skipped = 0;
    const failures: string[] = [];
    for (const record of raw) {
      try {
        const result = adapter.map(record as never);
        skipped += result.skipped.length;
        if (result.skipped.length > 0) log(`skipped: ${result.skipped.join(", ")}`);
        if (result.place) written += await store.applyPlace(meta, result.place, startedAt);
      } catch (e) {
        failures.push(message(e));
      }
    }

    if (failures.length === raw.length) return await fail(`All records failed, first: ${failures[0]}`, raw.length);

    const summary: RunSummary = {
      status: failures.length > 0 ? "partial" : "ok",
      recordsSeen: raw.length,
      recordsWritten: written,
      recordsSkipped: skipped + failures.length,
      error: failures.length > 0 ? `${failures.length} records failed, first: ${failures[0]}` : null,
    };
    await store.finishRun(runId, summary);
    await store.markSource(meta.id, { ok: true }, now());
    return summary;
  } catch (e) {
    return fail(message(e));
  }
}
