import type { MappedPlace, SourceAdapter, SourceMeta } from "./adapter";
import type { CityConfig } from "./cities/types";
import { isRetryable, SourceHttpError } from "./errors";

export type RunStatus = "ok" | "partial" | "failed";

export type RunSummary = {
  status: RunStatus;
  recordsSeen: number;
  recordsWritten: number;
  recordsSkipped: number;
  error: string | null;
  /** Where the records came from when not the source's usual endpoint (e.g. an extract). */
  note: string | null;
};

/** Everything the runner needs from storage; the Drizzle implementation lives in store.ts. */
export interface IngestStore {
  upsertSource(meta: SourceMeta): Promise<void>;
  startRun(sourceId: string): Promise<string>;
  finishRun(runId: string, summary: RunSummary): Promise<void>;
  /** Number of facts inserted or superseded (refreshing an unchanged fact doesn't count). */
  applyPlace(meta: SourceMeta, place: MappedPlace, fetchedAt: Date): Promise<number>;
  markSource(sourceId: string, outcome: { ok: true; note?: string | null } | { ok: false; error: string }, at: Date): Promise<void>;
}

export type RunOptions = {
  adapter: SourceAdapter<never>;
  city: CityConfig;
  store: IngestStore;
  userAgent: string;
  now?: () => Date;
  log?: (message: string) => void;
  /** Fetch attempts before the run fails; waits `baseDelayMs * 2^n` between them. Default 3 × 1 s. */
  retry?: { attempts: number; baseDelayMs: number };
  /** Source ids that behave as failed without being fetched (demo switch, see `SIMULATE_SOURCE_OUTAGE`). */
  simulateOutage?: readonly string[];
  sleep?: (ms: number) => Promise<void>;
  /** Records written at the same time, each in its own transaction (one DB connection each). Default 1: one after another. */
  concurrency?: number;
};

export const SIMULATED_OUTAGE_ERROR = "Simulated outage (SIMULATE_SOURCE_OUTAGE)";
const DEFAULT_RETRY = { attempts: 3, baseDelayMs: 1000 };
const MAX_WAIT_MS = 30_000;
const DEFAULT_CONCURRENCY = 1;

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
  if (!meta.licenseConfirmed) {
    throw new Error(`Licence of source ${meta.id} is not confirmed (${meta.license}); not ingesting`);
  }

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
      note: null,
    };
    await store.finishRun(runId, summary);
    await store.markSource(meta.id, { ok: false, error }, now());
    return summary;
  };

  if (options.simulateOutage?.includes(meta.id)) return fail(SIMULATED_OUTAGE_ERROR);

  const { attempts, baseDelayMs } = options.retry ?? DEFAULT_RETRY;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const fetchWithRetry = async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await adapter.fetch({ city, userAgent, log });
      } catch (e) {
        if (attempt >= attempts || !isRetryable(e)) throw e;
        log(`fetch attempt ${attempt}/${attempts} failed: ${message(e)}`);
        const hinted = e instanceof SourceHttpError ? e.retryAfterMs : undefined;
        await sleep(Math.min(hinted ?? baseDelayMs * 2 ** (attempt - 1), MAX_WAIT_MS));
      }
    }
  };

  try {
    const fetched = await fetchWithRetry();
    const raw = Array.isArray(fetched) ? fetched : fetched.records;
    const note = Array.isArray(fetched) ? null : fetched.note;
    if (!Array.isArray(raw) || raw.length === 0) return await fail("Source returned no records");

    let written = 0;
    let skipped = 0;
    const failures: string[] = [];
    let next = 0;
    const worker = async () => {
      while (next < raw.length) {
        const record = raw[next++];
        try {
          const result = adapter.map(record as never);
          skipped += result.skipped.length;
          if (result.skipped.length > 0) log(`skipped: ${result.skipped.join(", ")}`);
          // Not `written += await`: that reads `written` before another worker adds to it.
          const changed = result.place ? await store.applyPlace(meta, result.place, startedAt) : 0;
          written += changed;
        } catch (e) {
          failures.push(message(e));
        }
      }
    };
    const workers = Math.max(1, Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, raw.length));
    await Promise.all(Array.from({ length: workers }, worker));

    if (failures.length === raw.length) return await fail(`All records failed, first: ${failures[0]}`, raw.length);

    const summary: RunSummary = {
      status: failures.length > 0 ? "partial" : "ok",
      recordsSeen: raw.length,
      recordsWritten: written,
      recordsSkipped: skipped + failures.length,
      error: failures.length > 0 ? `${failures.length} records failed, first: ${failures[0]}` : null,
      note,
    };
    await store.finishRun(runId, summary);
    await store.markSource(meta.id, { ok: true, note }, now());
    return summary;
  } catch (e) {
    return await fail(message(e));
  }
}
