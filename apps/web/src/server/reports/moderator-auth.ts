import { createHash, timingSafeEqual } from "node:crypto";
import { clientKey, createRateLimiter, HttpError, type RateLimiter } from "@/server/http";
import { DEMO_MODERATOR_NAME } from "./demo";

const MIN_TOKEN_LENGTH = 16;

/** Who signed in: the name goes into the decision history; `demo` is the public demo account. */
export type ModeratorPrincipal = { name: string; demo: boolean };

type Moderator = ModeratorPrincipal & { digest: Buffer };

const digest = (token: string) => createHash("sha256").update(token).digest();

/**
 * Parses `MODERATOR_TOKENS` — comma-separated `name:token` pairs (see `.env.example`) — and the demo account's
 * `MODERATOR_DEMO_TOKEN`. Tokens shorter than 16 characters are ignored, so a weak placeholder never opens the panel;
 * so is a real moderator named like the demo account, whose decisions are undone automatically.
 */
export function parseModerators(raw: string | undefined, demoToken?: string): Moderator[] {
  const moderators = (raw ?? "")
    .split(",")
    .map((pair) => pair.trim())
    .flatMap((pair) => {
      const separator = pair.indexOf(":");
      const name = pair.slice(0, separator).trim();
      const token = pair.slice(separator + 1).trim();
      return separator > 0 && name && name !== DEMO_MODERATOR_NAME && token.length >= MIN_TOKEN_LENGTH
        ? [{ name, demo: false, digest: digest(token) }]
        : [];
    });
  const demo = demoToken?.trim() ?? "";
  return demo.length >= MIN_TOKEN_LENGTH
    ? [...moderators, { name: DEMO_MODERATOR_NAME, demo: true, digest: digest(demo) }]
    : moderators;
}

/** 5 failed attempts per client lock it out for 15 minutes. */
const failedLogins = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });

/**
 * Returns the moderator for the request's bearer token. Throws 429 while the client is locked out
 * (checked before the token, so a lockout can't be used to keep guessing) and 401 on a missing or wrong token.
 */
export function authenticateModerator(
  request: Request,
  moderators: Moderator[] = parseModerators(process.env.MODERATOR_TOKENS, process.env.MODERATOR_DEMO_TOKEN),
  failures: RateLimiter = failedLogins,
): ModeratorPrincipal {
  const key = clientKey(request);
  const lockout = failures.peek(key);
  if (!lockout.allowed) {
    throw new HttpError(429, {
      detail: `Too many failed sign-in attempts. Retry in ${lockout.retryAfterSeconds} s.`,
      headers: { "retry-after": String(lockout.retryAfterSeconds) },
    });
  }

  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]?.trim();
  if (token) {
    const given = digest(token);
    // Compare against every moderator so the time taken doesn't reveal which one (if any) matched.
    const match = moderators.reduce<Moderator | null>((found, m) => (timingSafeEqual(m.digest, given) ? m : found), null);
    if (match) return { name: match.name, demo: match.demo };
  }

  failures.check(key);
  throw new HttpError(401, {
    detail: moderators.length === 0 ? "Moderation is not configured on this server." : "A valid moderator token is required.",
    headers: { "www-authenticate": 'Bearer realm="moderation"' },
  });
}
