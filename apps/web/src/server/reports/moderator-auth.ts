import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { clientKey, createRateLimiter, HttpError, type RateLimiter } from "@/server/http";
import { DEMO_MODERATOR_NAME, DEMO_REVERT_MINUTES } from "./demo";

const MIN_TOKEN_LENGTH = 16;

/** Who signed in: the name goes into the decision history; `demo` is the public demo account. */
export type ModeratorPrincipal = { name: string; demo: boolean };

/** `sessionKey`: the demo account's only — signs its one-click sessions (`issueDemoSession`). */
type Moderator = ModeratorPrincipal & { digest: Buffer; sessionKey?: Buffer };

const digest = (token: string) => createHash("sha256").update(token).digest();

/** How long a one-click demo session lasts. */
export const DEMO_SESSION_HOURS = 12;

const SESSION_PREFIX = "kbb-demo";

const sign = (key: Buffer, expires: number) =>
  createHmac("sha256", key).update(`${SESSION_PREFIX}.${expires}`).digest("base64url");

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
    ? [
        ...moderators,
        {
          name: DEMO_MODERATOR_NAME,
          demo: true,
          digest: digest(demo),
          sessionKey: createHmac("sha256", demo).update("demo-session").digest(),
        },
      ]
    : moderators;
}

const configuredModerators = () => parseModerators(process.env.MODERATOR_TOKENS, process.env.MODERATOR_DEMO_TOKEN);

/** Whether the server has a demo account, i.e. whether the one-click demo sign-in is offered. */
export function isDemoAccountEnabled(moderators: Moderator[] = configuredModerators()): boolean {
  return moderators.some((m) => m.sessionKey);
}

/**
 * What the sign-in screens (/moderator, /miasto) pass to `DemoSignIn`: the demo account's revert time when the
 * one-click entry is offered, `null` when it isn't. The example-data mode stands in for a demo account
 * (see mock-moderation), so it offers the entry too.
 */
export function demoSignInMinutes(mockApi: boolean, moderators: Moderator[] = configuredModerators()): number | null {
  return mockApi || isDemoAccountEnabled(moderators) ? DEMO_REVERT_MINUTES : null;
}

/**
 * Issues a session of the demo account: `kbb-demo.<expiry ms>.<HMAC>`, signed with a key derived from
 * `MODERATOR_DEMO_TOKEN`, so neither that token nor a real moderator's ever reaches the browser. Such a session
 * signs in only as the demo account. `null` when there is no demo account.
 */
export function issueDemoSession(
  moderators: Moderator[] = configuredModerators(),
  now: Date = new Date(),
): { token: string; expiresAt: Date; moderator: ModeratorPrincipal } | null {
  const demo = moderators.find((m) => m.sessionKey);
  if (!demo?.sessionKey) return null;
  const expires = now.getTime() + DEMO_SESSION_HOURS * 3_600_000;
  return {
    token: `${SESSION_PREFIX}.${expires}.${sign(demo.sessionKey, expires)}`,
    expiresAt: new Date(expires),
    moderator: { name: demo.name, demo: true },
  };
}

/** The demo account, when `token` is one of its unexpired sessions. */
function demoSessionAccount(token: string, moderators: Moderator[], now: number): Moderator | null {
  const [prefix, expiresText = "", signature, ...rest] = token.split(".");
  const demo = moderators.find((m) => m.sessionKey);
  if (prefix !== SESSION_PREFIX || rest.length > 0 || !signature || !/^\d+$/.test(expiresText) || !demo?.sessionKey) {
    return null;
  }
  const expires = Number(expiresText);
  const expected = Buffer.from(sign(demo.sessionKey, expires));
  const given = Buffer.from(signature);
  const valid = given.length === expected.length && timingSafeEqual(given, expected);
  return valid && expires > now ? demo : null;
}

/** 5 failed attempts per client lock it out for 15 minutes. */
const failedLogins = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });

/**
 * Returns the moderator for the request's bearer token — a moderator's token, or a demo session (`issueDemoSession`),
 * which only ever signs in as the demo account. Throws 429 while the client is locked out (checked before the token,
 * so a lockout can't be used to keep guessing) and 401 on a missing or wrong token.
 */
export function authenticateModerator(
  request: Request,
  moderators: Moderator[] = configuredModerators(),
  failures: RateLimiter = failedLogins,
  now: Date = new Date(),
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
    const demo = demoSessionAccount(token, moderators, now.getTime());
    if (demo) return { name: demo.name, demo: true };
  }

  failures.check(key);
  throw new HttpError(401, {
    detail: moderators.length === 0 ? "Moderation is not configured on this server." : "A valid moderator token is required.",
    headers: { "www-authenticate": 'Bearer realm="moderation"' },
  });
}
