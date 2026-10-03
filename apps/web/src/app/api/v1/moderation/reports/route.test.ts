import type { ModerationReport, Report } from "@krakow-bez-barier/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAttribute } from "@/server/domain";
import { validateResponse } from "@/server/http";
import { COMMUNITY_MODERATED_SOURCE, pendingReportsByAttribute } from "@/server/reports";
import { jsonRequest, PLACE_ID, seededReportsStore } from "@/server/reports/testing";

let memory = seededReportsStore();
vi.mock("@/server/reports/drizzle-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/reports/drizzle-store")>()),
  reportsStore: () => memory.store,
}));

const { GET, POST } = await import("./route");

const url = "http://localhost/api/v1/moderation/reports";
const ANNA = "anna-token-0123456789";
let client = 0;
const auth = (token = ANNA, ip = `198.51.100.${++client}`) => ({ authorization: `Bearer ${token}`, "x-forwarded-for": ip });

const list = (query = "", headers = auth()) => GET(new Request(`${url}${query}`, { headers }));
const decide = (body: unknown, headers = auth()) => POST(jsonRequest(url, body, headers));

async function report(attribute: "lift" | "bench", value: boolean) {
  return memory.store.insertReport({ placeId: PLACE_ID, attribute, value: { kind: "boolean", boolean: value }, comment: null });
}

beforeEach(() => {
  memory = seededReportsStore();
  vi.stubEnv("MODERATOR_TOKENS", `anna:${ANNA}, short:abc`);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("moderation sign-in", () => {
  it("answers 401 without a valid token, then locks the client out after 5 failures", async () => {
    // GIVEN a client guessing tokens
    const ip = "203.0.113.77";
    const missing = await list("", { "x-forwarded-for": ip } as never);

    // WHEN it fails 5 times in total and then sends the right token
    const failures = [missing.status];
    for (let i = 0; i < 4; i++) failures.push((await list("", auth("wrong-token-0123456789", ip))).status);
    const locked = await list("", auth(ANNA, ip));

    // THEN every failure is a 401 asking for a bearer token, and the lockout holds even for the right token
    expect(failures).toEqual([401, 401, 401, 401, 401]);
    expect(missing.headers.get("www-authenticate")).toContain("Bearer");
    expect(locked.status).toBe(429);
    expect(locked.headers.get("retry-after")).toBeTruthy();
  });

  it("ignores tokens shorter than 16 characters", async () => {
    // WHEN the configured short token is used
    const res = await list("", auth("abc"));

    // THEN it does not sign in
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/moderation/reports", () => {
  it("lists the queue oldest first with the current value, history and a cursor", async () => {
    // GIVEN three reports
    const lift = await report("lift", false);
    await report("bench", true);
    await report("bench", false);

    // WHEN a moderator reads two per page, filtered to new
    const res = await list("?status=new&limit=2");

    // THEN the page is spec-valid and shows what the card says now
    expect(res.status).toBe(200);
    const page = await res.json();
    expect(validateResponse("listModerationReports", 200, page)).toEqual([]);
    expect(page.items.map((r: ModerationReport) => r.id)[0]).toBe(lift.id);
    expect(page.items[0]).toMatchObject({
      placeName: "Podziemia Rynku",
      currentValue: { kind: "boolean", boolean: true },
      history: [],
    });
    expect(page.items[1].currentValue).toBeNull();

    // AND the cursor leads to the last report
    const next = await (await list(`?status=new&limit=2&cursor=${page.nextCursor}`)).json();
    expect(next.items).toHaveLength(1);
    expect(next.nextCursor).toBeNull();
  });
});

describe("POST /api/v1/moderation/reports", () => {
  it("accepting adds a fact from the moderated community source with the decision date, beside other sources", async () => {
    // GIVEN a report that the OpenStreetMap lift is broken
    const pending = await report("lift", false);

    // WHEN a moderator accepts it
    const res = await decide({ reportId: pending.id, decision: "accepted" });

    // THEN the report is accepted with a decision date
    expect(res.status).toBe(200);
    const body: Report = await res.json();
    expect(validateResponse("decideModerationReport", 200, body)).toEqual([]);
    expect(body).toMatchObject({ status: "accepted", decidedAt: expect.any(String) });

    // AND a fact from "Społeczność, zweryfikowane przez moderatora" carries that date
    const added = memory.facts.find((f) => f.source.id === COMMUNITY_MODERATED_SOURCE.id);
    expect(added).toMatchObject({
      source: { name: "Społeczność, zweryfikowane przez moderatora", kind: "user_report" },
      reliability: "confirmed",
      confirmedAt: body.decidedAt,
      value: { kind: "boolean", boolean: false },
      status: "active",
    });

    // AND the OpenStreetMap fact is untouched, so the card shows the disagreement instead of a silent swap
    expect(memory.facts.find((f) => f.source.id === "osm")?.status).toBe("active");
    expect(resolveAttribute("lift", memory.facts).state).toBe("conflict");
    expect((await pendingReportsByAttribute(memory.store, PLACE_ID)).get("lift")).toBeUndefined();
  });

  it("supersedes the community source's earlier fact on a second accepted report", async () => {
    // GIVEN one accepted bench report
    await decide({ reportId: (await report("bench", false)).id, decision: "accepted" });

    // WHEN a later report for the same attribute is accepted
    await decide({ reportId: (await report("bench", true)).id, decision: "accepted" });

    // THEN only the newer community fact is active
    const bench = memory.facts.filter((f) => f.attribute === "bench");
    expect(bench.map((f) => f.status)).toEqual(["superseded", "active"]);
    expect(resolveAttribute("bench", memory.facts)).toMatchObject({ state: "known", status: "confirmed", value: { boolean: true } });
  });

  it("keeps a needs-info report pending, records history, and makes accepted or rejected final", async () => {
    // GIVEN a report
    const pending = await report("lift", false);

    // WHEN it is marked for clarification, then rejected, then decided again
    const asked = await decide({ reportId: pending.id, decision: "needs_info", note: "Które wejście?" });
    const stillPending = (await pendingReportsByAttribute(memory.store, PLACE_ID)).get("lift");
    const rejected = await decide({ reportId: pending.id, decision: "rejected" });
    const again = await decide({ reportId: pending.id, decision: "accepted" });

    // THEN needs_info stays on the card as unverified, rejection removes it, and a final report can't change
    expect(asked.status).toBe(200);
    expect(stillPending).toEqual([expect.objectContaining({ status: "needs_info" })]);
    expect(rejected.status).toBe(200);
    expect((await pendingReportsByAttribute(memory.store, PLACE_ID)).get("lift")).toBeUndefined();
    expect(again.status).toBe(409);
    expect(validateResponse("decideModerationReport", 409, await again.json())).toEqual([]);

    // AND the history shows who decided what and when
    const queue = await (await list()).json();
    expect(queue.items[0].history).toEqual([
      { decision: "needs_info", note: "Które wejście?", moderator: "anna", decidedAt: expect.any(String) },
      { decision: "rejected", note: null, moderator: "anna", decidedAt: expect.any(String) },
    ]);
    expect(memory.facts.filter((f) => f.attribute === "lift")).toHaveLength(1);
  });

  it("answers 404 for an unknown report", async () => {
    // WHEN the report does not exist
    const res = await decide({ reportId: "nope", decision: "rejected" });

    // THEN 404
    expect(res.status).toBe(404);
  });
});
