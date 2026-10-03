/** A source answered, but not with success. `retryAfterMs` comes from a Retry-After header. */
export class SourceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "SourceHttpError";
  }
}

const RETRYABLE_STATUS = new Set([429, 502, 503]);

/**
 * Worth another attempt: rate limiting, a briefly unavailable gateway, or a network error.
 * Not worth it: other HTTP errors (a heavy query that times out at the provider with 504 or a
 * client error will fail again) and our own request timeout.
 */
export function isRetryable(e: unknown): boolean {
  if (e instanceof SourceHttpError) return RETRYABLE_STATUS.has(e.status);
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) return false;
  return true;
}

export function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}
