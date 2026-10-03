export type RateLimitOptions = {
  /** Requests allowed per client per window. */
  limit: number;
  windowMs: number;
  /** Injectable clock for tests. */
  now?: () => number;
};

const MAX_TRACKED_CLIENTS = 10_000;

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type RateLimiter = {
  readonly limit: number;
  /** Counts one request for `key` and says whether it is within the limit. */
  check(key: string): RateLimitDecision;
  /** Says whether the next `check(key)` would be allowed, without counting anything. */
  peek(key: string): RateLimitDecision;
};

/**
 * Fixed-window counter per client key, held in process memory only: nothing is persisted or logged (R7),
 * and limits are per server instance — good enough to stop a burst, not a global quota.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }: RateLimitOptions): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  function sweep(time: number) {
    for (const [key, w] of windows) if (time - w.start >= windowMs) windows.delete(key);
    // Still full (many distinct keys in one window): forget the oldest, so memory stays bounded.
    for (const key of windows.keys()) {
      if (windows.size < MAX_TRACKED_CLIENTS) break;
      windows.delete(key);
    }
  }

  const refused = (start: number, time: number): RateLimitDecision => ({
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((start + windowMs - time) / 1000)),
  });

  return {
    limit,
    check(key) {
      const time = now();
      if (windows.size >= MAX_TRACKED_CLIENTS) sweep(time);
      const current = windows.get(key);
      if (!current || time - current.start >= windowMs) {
        windows.set(key, { start: time, count: 1 });
        return { allowed: true };
      }
      if (current.count < limit) {
        current.count += 1;
        return { allowed: true };
      }
      return refused(current.start, time);
    },
    peek(key) {
      const time = now();
      const current = windows.get(key);
      if (!current || time - current.start >= windowMs || current.count < limit) return { allowed: true };
      return refused(current.start, time);
    },
  };
}

/**
 * Client key for rate limits, lockouts and one-confirmation-per-client: the address the hosting proxy saw. Trusts the
 * proxy in front of the app (Vercel) — `x-vercel-forwarded-for`, else the last `x-forwarded-for` hop, which the nearest
 * proxy appends; the leftmost hops are whatever the client sent. Without a proxy every request shares one bucket.
 */
export function clientKey(request: Request): string {
  const lastHop = (header: string) => request.headers.get(header)?.split(",").at(-1)?.trim();
  return lastHop("x-vercel-forwarded-for") || lastHop("x-forwarded-for") || request.headers.get("x-real-ip") || "anonymous";
}
