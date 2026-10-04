import type { DemoModeratorSession } from "@krakow-bez-barier/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter, validateResponse } from "@/server/http";
import {
  authenticateModerator,
  DEMO_MODERATED_SOURCE,
  DEMO_MODERATOR_NAME,
  DEMO_REVERT_MINUTES,
  demoSignInMinutes,
  issueDemoSession,
  parseModerators,
} from "@/server/reports";
import { jsonRequest, PLACE_ID, seededReportsStore } from "@/server/reports/testing";

let memory = seededReportsStore();
vi.mock("@/server/reports/drizzle-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/reports/drizzle-store")>()),
  reportsStore: () => memory.store,
}));

const { POST: createSession } = await import("./route");
const { GET: listReports, POST: decideReport } = await import("../reports/route");

const ANNA = "anna-token-0123456789";
const unauthorized = expect.objectContaining({ problem: expect.objectContaining({ status: 401 }) });
const DEMO = "konto-demo-token-0123456789";
const reportsUrl = "http://localhost/api/v1/moderation/reports";
let client = 0;
const ip = () => `198.51.100.${++client}`;
const auth = (token: string) => ({ authorization: `Bearer ${token}`, "x-forwarded-for": ip() });

const newSession = () =>
  createSession(new Request("http://localhost/api/v1/moderation/demo-session", { method: "POST", headers: { "x-forwarded-for": ip() } }));
const list = (token: string) => listReports(new Request(reportsUrl, { headers: auth(token) }));

beforeEach(() => {
  memory = seededReportsStore();
  vi.stubEnv("MODERATOR_TOKENS", `anna:${ANNA}`);
  vi.stubEnv("MODERATOR_DEMO_TOKEN", DEMO);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("demoSignInMinutes (the one-click entry on /moderator and /miasto)", () => {
  it("offers the entry with its revert time when the server has a demo account", () => {
    // GIVEN MODERATOR_DEMO_TOKEN is set (beforeEach), real data
    // WHEN the sign-in screen asks whether to offer the entry
    // THEN it gets the revert time
    expect(demoSignInMinutes(false)).toBe(DEMO_REVERT_MINUTES);
  });

  it("offers nothing on real data without a demo account, but does in the example-data mode", () => {
    // GIVEN no demo account configured
    vi.stubEnv("MODERATOR_DEMO_TOKEN", "");

    // WHEN the sign-in screens ask, on real data and in the example-data mode
    // THEN real data gets no entry (the screen says it is off) and the mock stands in for the demo account
    expect(demoSignInMinutes(false)).toBeNull();
    expect(demoSignInMinutes(true)).toBe(DEMO_REVERT_MINUTES);
  });
});

describe("POST /moderation/demo-session", () => {
  it("issues a demo session without handing out the demo or a moderator token", async () => {
    // WHEN the jury clicks the demo sign-in
    const res = await newSession();
    const body = (await res.json()) as DemoModeratorSession;

    // THEN a session of the demo account comes back, shaped as the spec says
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(validateResponse("createDemoModeratorSession", 201, body)).toEqual([]);
    expect(body.moderator).toEqual({ name: DEMO_MODERATOR_NAME, demo: true, revertsAfterMinutes: DEMO_REVERT_MINUTES });
    // AND no configured token is in it
    expect(JSON.stringify(body)).not.toContain(DEMO);
    expect(JSON.stringify(body)).not.toContain(ANNA);
  });

  it("signs in only as the demo account, whose approvals go to the temporary demo source", async () => {
    // GIVEN a demo session and a new report
    const { token } = (await (await newSession()).json()) as DemoModeratorSession;
    const report = await memory.store.insertReport({
      placeId: PLACE_ID,
      attribute: "lift",
      value: { kind: "boolean", boolean: false },
      comment: null,
    });

    // WHEN the session reads the queue and approves the report
    const queue = await (await list(token)).json();
    const decided = await decideReport(jsonRequest(reportsUrl, { reportId: report.id, decision: "accepted" }, auth(token)));

    // THEN it is the demo account, not a real moderator, and the fact comes from the demo source
    expect(queue.moderator).toEqual({ name: DEMO_MODERATOR_NAME, demo: true, revertsAfterMinutes: DEMO_REVERT_MINUTES });
    expect(decided.status).toBe(200);
    expect(memory.facts.find((f) => f.source.id === DEMO_MODERATED_SOURCE.id)).toBeDefined();
    const history = (await (await list(token)).json()).items.find((r: { id: string }) => r.id === report.id).history;
    expect(history.at(-1)).toMatchObject({ decision: "accepted", moderator: DEMO_MODERATOR_NAME });
  });

  it("answers 404 and offers nothing when the server has no demo account", async () => {
    // GIVEN only real moderators are configured
    vi.stubEnv("MODERATOR_DEMO_TOKEN", "");

    // WHEN a demo session is asked for
    const res = await newSession();

    // THEN there is none
    expect(res.status).toBe(404);
    expect(validateResponse("createDemoModeratorSession", 404, await res.json())).toEqual([]);
  });

  it("limits how many sessions one client can take", async () => {
    // GIVEN one client asking again and again
    const headers = { "x-forwarded-for": "203.0.113.90" };
    const ask = () =>
      createSession(new Request("http://localhost/api/v1/moderation/demo-session", { method: "POST", headers }));

    // WHEN it asks 21 times
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await ask()).status);

    // THEN the 21st is refused
    expect(statuses.slice(0, 20).every((s) => s === 201)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});

describe("demo session tokens", () => {
  const moderators = parseModerators(`anna:${ANNA}`, DEMO);
  const now = new Date("2026-10-04T09:00:00Z");
  const signIn = (token: string, at = now) =>
    authenticateModerator(
      new Request(reportsUrl, { headers: auth(token) }),
      moderators,
      createRateLimiter({ limit: 100, windowMs: 60_000 }),
      at,
    );

  it("is the demo account until it expires, then signs in as nobody", () => {
    // GIVEN a session issued now
    const session = issueDemoSession(moderators, now)!;

    // WHEN it is used within its lifetime and after it
    const during = signIn(session.token, new Date(session.expiresAt.getTime() - 1));

    // THEN it is the demo account, and an expired one is a 401
    expect(during).toEqual({ name: DEMO_MODERATOR_NAME, demo: true });
    expect(() => signIn(session.token, session.expiresAt)).toThrow(unauthorized);
  });

  it("can't be forged or extended, and stops working when the demo token changes", () => {
    // GIVEN a valid session
    const [prefix, expires, signature] = issueDemoSession(moderators, now)!.token.split(".");

    // WHEN its expiry is pushed back, the signature is dropped, or the demo token is rotated
    const extended = `${prefix}.${Number(expires) + 86_400_000}.${signature}`;
    const unsigned = `${prefix}.${expires}.`;
    const rotated = parseModerators(`anna:${ANNA}`, "another-demo-token-0123456789");

    // THEN none of them signs in
    expect(() => signIn(extended)).toThrow(unauthorized);
    expect(() => signIn(unsigned)).toThrow(unauthorized);
    expect(() =>
      authenticateModerator(
        new Request(reportsUrl, { headers: auth(`${prefix}.${expires}.${signature}`) }),
        rotated,
        createRateLimiter({ limit: 100, windowMs: 60_000 }),
        now,
      ),
    ).toThrow(unauthorized);
  });

  it("is never issued, and never accepted, without a demo account", () => {
    // GIVEN a session from a server that had the demo account, and one that doesn't
    const token = issueDemoSession(moderators, now)!.token;
    const realOnly = parseModerators(`anna:${ANNA}`);

    // THEN the second issues nothing and refuses the old session
    expect(issueDemoSession(realOnly, now)).toBeNull();
    expect(() =>
      authenticateModerator(
        new Request(reportsUrl, { headers: auth(token) }),
        realOnly,
        createRateLimiter({ limit: 100, windowMs: 60_000 }),
        now,
      ),
    ).toThrow(unauthorized);
  });
});
