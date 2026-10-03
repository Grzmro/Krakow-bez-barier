import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit per window, then reports when to retry", () => {
    // GIVEN 2 requests per 10 s on a controllable clock
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 10_000, now: () => now });

    // WHEN one client makes three calls at once
    const decisions = [limiter.check("a"), limiter.check("a"), limiter.check("a")];

    // THEN the third is refused with the remaining window in seconds
    expect(decisions).toEqual([{ allowed: true }, { allowed: true }, { allowed: false, retryAfterSeconds: 10 }]);

    // AND another client and a new window are unaffected
    expect(limiter.check("b")).toEqual({ allowed: true });
    now = 10_000;
    expect(limiter.check("a")).toEqual({ allowed: true });
  });
});

describe("peek", () => {
  it("reports the decision without using up the limit", () => {
    // GIVEN 1 request per 10 s
    let now = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 10_000, now: () => now });

    // WHEN a client peeks twice, then checks twice
    const peeks = [limiter.peek("a"), limiter.peek("a")];
    const checks = [limiter.check("a"), limiter.check("a")];

    // THEN peeking never counted, and once the limit is used up peek refuses too
    expect(peeks).toEqual([{ allowed: true }, { allowed: true }]);
    expect(checks.map((d) => d.allowed)).toEqual([true, false]);
    expect(limiter.peek("a")).toEqual({ allowed: false, retryAfterSeconds: 10 });
    now = 10_000;
    expect(limiter.peek("a")).toEqual({ allowed: true });
  });
});

describe("clientKey", () => {
  it("uses the first forwarded hop and falls back to one shared bucket", () => {
    // GIVEN requests with and without proxy headers
    const forwarded = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } });
    const bare = new Request("http://x");

    // WHEN keys are derived
    // THEN the client address is used when the proxy provides one
    expect(clientKey(forwarded)).toBe("203.0.113.7");
    expect(clientKey(bare)).toBe("anonymous");
  });
});
