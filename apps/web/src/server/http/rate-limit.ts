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
  check(key: string): RateLimitDecision;
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
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.start + windowMs - time) / 1000)) };
    },
  };
}

/** Client key for rate limiting: the first `x-forwarded-for` hop (set by the hosting proxy), else one shared bucket. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "anonymous";
}
