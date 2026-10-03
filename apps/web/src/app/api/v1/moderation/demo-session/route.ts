import { createRateLimiter, defineRoute, HttpError, respond } from "@/server/http";
import { issueDemoSession, moderatorSession } from "@/server/reports";

const sessions = createRateLimiter({ limit: 20, windowMs: 15 * 60_000 });

export const POST = defineRoute(
  "createDemoModeratorSession",
  async () => {
    const session = issueDemoSession();
    if (!session) throw new HttpError(404, { detail: "This server has no demo moderator account." });
    return respond(
      201,
      { token: session.token, expiresAt: session.expiresAt.toISOString(), moderator: moderatorSession(session.moderator) },
      { "cache-control": "no-store" },
    );
  },
  { rateLimit: sessions },
);
