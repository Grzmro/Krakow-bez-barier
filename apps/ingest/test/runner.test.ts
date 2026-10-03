import { describe, expect, it } from "vitest";
import type { MappedPlace, SourceAdapter, SourceMeta } from "../src/adapter";
import { krakow } from "../src/cities/krakow";
import { SourceHttpError } from "../src/errors";
import { runIngest, SIMULATED_OUTAGE_ERROR, type IngestStore, type RunSummary } from "../src/runner";

const meta: SourceMeta = {
  id: "artificial",
  name: "Artificial source",
  kind: "official_open_data",
  url: "https://example.org",
  license: "CC0",
  licenseConfirmed: true,
  attribution: "Example",
  refreshInterval: "daily",
  baseReliability: "confirmed",
};

const place = (n: number): MappedPlace => ({
  externalRef: `artificial:${n}`,
  name: `Place ${n}`,
  category: "other",
  location: { x: 19.94, y: 50.05 },
  street: null,
  houseNumber: null,
  facts: [],
});

function memoryStore() {
  const calls = { applied: [] as string[], runs: [] as RunSummary[], source: [] as unknown[] };
  const store: IngestStore = {
    upsertSource: async () => {},
    startRun: async () => "run-1",
    finishRun: async (_id, summary) => void calls.runs.push(summary),
    applyPlace: async (_meta, p) => {
      calls.applied.push(p.externalRef);
      return 1;
    },
    markSource: async (_id, outcome) => void calls.source.push(outcome),
  };
  return { store, calls };
}

const run = (adapter: SourceAdapter<never>, store: IngestStore) =>
  runIngest({ adapter, city: krakow, store, userAgent: "test", retry: { attempts: 1, baseDelayMs: 0 } });

describe("runIngest", () => {
  it("ingests a source added without touching anything else", async () => {
    // GIVEN an artificial adapter that exists only in this test
    const adapter: SourceAdapter<number> = {
      meta,
      fetch: async () => [1, 2],
      map: (n) => ({ place: place(n), skipped: n === 2 ? ["x=y"] : [] }),
    };
    const { store, calls } = memoryStore();
    // WHEN running it
    const summary = await run(adapter as SourceAdapter<never>, store);
    // THEN both places are stored, the skipped value is counted and the source is marked ok
    expect(calls.applied).toEqual(["artificial:1", "artificial:2"]);
    expect(summary).toMatchObject({ status: "ok", recordsSeen: 2, recordsWritten: 2, recordsSkipped: 1 });
    expect(calls.source).toEqual([{ ok: true }]);
  });

  it("writes nothing and marks the source when the fetch fails", async () => {
    // GIVEN an adapter whose source is down
    const adapter: SourceAdapter<number> = {
      meta,
      fetch: async () => {
        throw new Error("Overpass responded 504");
      },
      map: () => ({ place: null, skipped: [] }),
    };
    const { store, calls } = memoryStore();
    // WHEN running it
    const summary = await run(adapter as SourceAdapter<never>, store);
    // THEN no place is applied, the run is failed and the source gets the error
    expect(calls.applied).toEqual([]);
    expect(summary).toMatchObject({ status: "failed", error: "Overpass responded 504" });
    expect(calls.source).toEqual([{ ok: false, error: "Overpass responded 504" }]);
  });

  it("reports a partial run and keeps going when one record fails to map", async () => {
    // GIVEN a mapper that throws for one record
    const adapter: SourceAdapter<number> = {
      meta,
      fetch: async () => [1, 2, 3],
      map: (n) => {
        if (n === 2) throw new Error("bad record");
        return { place: place(n), skipped: [] };
      },
    };
    const { store, calls } = memoryStore();
    // WHEN running it
    const summary = await run(adapter as SourceAdapter<never>, store);
    // THEN the other records are stored and the run is partial
    expect(calls.applied).toEqual(["artificial:1", "artificial:3"]);
    expect(summary).toMatchObject({ status: "partial", recordsWritten: 2, recordsSkipped: 1 });
  });

  it("fails the run and marks the source when every record fails or none arrive", async () => {
    // GIVEN a mapper that always throws, and a source that returns nothing
    const broken: SourceAdapter<number> = {
      meta,
      fetch: async () => [1, 2],
      map: () => {
        throw new Error("schema mismatch");
      },
    };
    const empty: SourceAdapter<number> = { meta, fetch: async () => [], map: () => ({ place: null, skipped: [] }) };
    const a = memoryStore();
    const b = memoryStore();
    // WHEN running them
    const brokenSummary = await run(broken as SourceAdapter<never>, a.store);
    const emptySummary = await run(empty as SourceAdapter<never>, b.store);
    // THEN neither marks the source fresh
    expect(brokenSummary.status).toBe("failed");
    expect(a.calls.source).toEqual([{ ok: false, error: "All records failed, first: schema mismatch" }]);
    expect(emptySummary).toMatchObject({ status: "failed", error: "Source returned no records" });
    expect(b.calls.source[0]).toMatchObject({ ok: false });
  });

  it("refuses a source whose licence is not confirmed, before fetching or writing", async () => {
    // GIVEN an adapter with an unconfirmed licence
    let fetched = false;
    const adapter: SourceAdapter<number> = {
      meta: { ...meta, license: "To be confirmed", licenseConfirmed: false },
      fetch: async () => {
        fetched = true;
        return [1];
      },
      map: (n) => ({ place: place(n), skipped: [] }),
    };
    const { store, calls } = memoryStore();
    // WHEN running it
    const result = run(adapter as SourceAdapter<never>, store);
    // THEN it is rejected and neither the source, a run row nor any place is touched
    await expect(result).rejects.toThrow("Licence of source artificial is not confirmed");
    expect(fetched).toBe(false);
    expect(calls).toEqual({ applied: [], runs: [], source: [] });
  });

  it("finishes the run as failed when something unexpected throws", async () => {
    // GIVEN storage that throws on the first write and adapter output that is not a list
    const adapter = { meta, fetch: async () => ({ remark: "x" }), map: () => ({ place: null, skipped: [] }) };
    const { store, calls } = memoryStore();
    // WHEN running it
    const summary = await run(adapter as unknown as SourceAdapter<never>, store);
    // THEN the run row is closed as failed instead of staying open
    expect(summary.status).toBe("failed");
    expect(calls.runs).toHaveLength(1);
  });

  it("retries a failing fetch with growing waits and ingests once it recovers", async () => {
    // GIVEN a source that fails twice, then answers
    let attempts = 0;
    const adapter: SourceAdapter<number> = {
      meta,
      fetch: async () => {
        if (++attempts < 3) throw new Error("HTTP 503");
        return [1];
      },
      map: (n) => ({ place: place(n), skipped: [] }),
    };
    const { store, calls } = memoryStore();
    const waits: number[] = [];
    // WHEN running it with three attempts
    const summary = await runIngest({
      adapter: adapter as SourceAdapter<never>,
      city: krakow,
      store,
      userAgent: "test",
      retry: { attempts: 3, baseDelayMs: 100 },
      sleep: async (ms) => void waits.push(ms),
    });
    // THEN it succeeds after waiting 100 ms and 200 ms
    expect(summary.status).toBe("ok");
    expect(waits).toEqual([100, 200]);
    expect(calls.source).toEqual([{ ok: true }]);
  });

  it("does not retry a permanent HTTP error and writes only the run row", async () => {
    // GIVEN a source that is always down
    let attempts = 0;
    const adapter: SourceAdapter<number> = {
      meta,
      fetch: async () => {
        attempts++;
        throw new SourceHttpError("HTTP 404", 404);
      },
      map: () => ({ place: null, skipped: [] }),
    };
    const { store, calls } = memoryStore();
    // WHEN running it with two attempts
    const summary = await runIngest({
      adapter: adapter as SourceAdapter<never>,
      city: krakow,
      store,
      userAgent: "test",
      retry: { attempts: 2, baseDelayMs: 0 },
    });
    // THEN a 404 is not retried, nothing is applied and the source is marked failed
    expect(attempts).toBe(1);
    expect(calls.applied).toEqual([]);
    expect(summary).toMatchObject({ status: "failed", error: "HTTP 404" });
  });

  it("fails a simulated-outage source without fetching it", async () => {
    // GIVEN an adapter that would work, but whose id is on the simulated outage list
    let fetched = false;
    const adapter: SourceAdapter<number> = {
      meta,
      fetch: async () => {
        fetched = true;
        return [1];
      },
      map: (n) => ({ place: place(n), skipped: [] }),
    };
    const { store, calls } = memoryStore();
    // WHEN running it
    const summary = await runIngest({
      adapter: adapter as SourceAdapter<never>,
      city: krakow,
      store,
      userAgent: "test",
      simulateOutage: [meta.id],
    });
    // THEN nothing is fetched or stored and the source is marked failed
    expect(fetched).toBe(false);
    expect(calls.applied).toEqual([]);
    expect(summary).toMatchObject({ status: "failed", error: SIMULATED_OUTAGE_ERROR });
    expect(calls.source).toEqual([{ ok: false, error: SIMULATED_OUTAGE_ERROR }]);
  });

  it("honours Retry-After on 429, caps the wait, and never retries our own timeout", async () => {
    // GIVEN a source answering 429 with Retry-After 5 s, then 120 s, and a second source timing out
    let calls = 0;
    const limited: SourceAdapter<number> = {
      meta,
      fetch: async () => {
        calls++;
        throw new SourceHttpError("HTTP 429", 429, calls === 1 ? 5000 : 120_000);
      },
      map: () => ({ place: null, skipped: [] }),
    };
    let timeouts = 0;
    const slow: SourceAdapter<number> = {
      meta,
      fetch: async () => {
        timeouts++;
        throw Object.assign(new Error("The operation timed out"), { name: "TimeoutError" });
      },
      map: () => ({ place: null, skipped: [] }),
    };
    const waits: number[] = [];
    // WHEN running both with three attempts
    await runIngest({
      adapter: limited as SourceAdapter<never>,
      city: krakow,
      store: memoryStore().store,
      userAgent: "test",
      retry: { attempts: 3, baseDelayMs: 1 },
      sleep: async (ms) => void waits.push(ms),
    });
    await runIngest({
      adapter: slow as SourceAdapter<never>,
      city: krakow,
      store: memoryStore().store,
      userAgent: "test",
      retry: { attempts: 3, baseDelayMs: 1 },
      sleep: async () => {},
    });
    // THEN the hint is used and capped at 30 s, and the timeout is tried once
    expect(waits).toEqual([5000, 30_000]);
    expect(timeouts).toBe(1);
  });
});
