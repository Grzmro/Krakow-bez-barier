import {
  responseExamples,
  type DemoModeratorSession,
  type ModerationDecision,
  type ModerationReport,
  type ModeratorSession,
  type Problem,
  type Report,
  type ReportStatus,
} from "@krakow-bez-barier/contracts";

// In-browser stand-in for the moderation API in the example-data mode (tests, demo recording) — the queue
// starts from the spec's example and decisions change it, so the panel can be demoed without a database.

/** Moderator name recorded in the mock history; the real API takes it from `MODERATOR_TOKENS`. */
export const MOCK_MODERATOR = "demo";

/** Signs in as the demo account (the real API: `MODERATOR_DEMO_TOKEN`), so its notice can be shown and tested. */
export const MOCK_DEMO_TOKEN = "konto-demo-0123456789";

const session = (token: string): ModeratorSession =>
  token === MOCK_DEMO_TOKEN
    ? { name: "Konto demonstracyjne", demo: true, revertsAfterMinutes: 30 }
    : { name: MOCK_MODERATOR, demo: false, revertsAfterMinutes: null };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": status < 400 ? "application/json" : "application/problem+json" },
  });

const problem = (status: number, title: string, detail: string) =>
  json({ type: "about:blank", title, status, detail } satisfies Problem, status);

export const seedModerationQueue = (): ModerationReport[] => structuredClone(responseExamples.listModerationReports[200].queue.items);

type Fetch = (input: Request) => Promise<Response>;

/** Answers `GET`/`POST /moderation/reports` from an in-memory queue; any bearer token signs in. */
export function withModerationMocks(fallback: Fetch, reports: ModerationReport[] = seedModerationQueue()): Fetch {
  return async (input) => {
    const url = new URL(input.url, "http://mock.local");
    const path = url.pathname.replace(/^.*\/api\/v1/, "");
    if (path === "/moderation/demo-session" && input.method === "POST") {
      const expiresAt = new Date(Date.now() + 12 * 3_600_000).toISOString();
      return json({ token: MOCK_DEMO_TOKEN, expiresAt, moderator: session(MOCK_DEMO_TOKEN) } satisfies DemoModeratorSession, 201);
    }
    if (path !== "/moderation/reports") return fallback(input);

    const token = /^Bearer\s+(\S.*)$/i.exec(input.headers.get("authorization") ?? "")?.[1]?.trim();
    if (!token) return problem(401, "Unauthorized", "A valid moderator token is required.");

    if (input.method === "GET") {
      const status = url.searchParams.get("status") as ReportStatus | null;
      return json({
        items: reports.filter((r) => !status || r.status === status),
        nextCursor: null,
        moderator: session(token),
      });
    }

    if (input.method === "POST") {
      const body = (await input.json()) as ModerationDecision;
      const report = reports.find((r) => r.id === body.reportId);
      if (!report) return problem(404, "Not found", `Report "${body.reportId}" does not exist.`);
      if (report.status === "accepted" || report.status === "rejected") {
        return problem(409, "Conflict", `Report "${body.reportId}" is already ${report.status}.`);
      }
      const decidedAt = new Date().toISOString();
      report.status = body.decision;
      report.decidedAt = decidedAt;
      report.history.push({ decision: body.decision, note: body.note?.trim() || null, moderator: session(token).name, decidedAt });
      const { id, placeId, attribute, value, comment, photoUrl, status, createdAt } = report;
      return json({ id, placeId, attribute, value, comment, photoUrl, status, createdAt, decidedAt } satisfies Report);
    }

    return fallback(input);
  };
}
