import { createRateLimiter, defineRoute, respond } from "@/server/http";
import { reportsStore, submitReport } from "@/server/reports";

// Per client ("na sesję i adres", US-4.5); held in memory only, nothing about the client is stored.
const limiter = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

export const POST = defineRoute(
  "createReport",
  async ({ header, body }) => {
    const { report, replaced } = await submitReport(reportsStore(), body, header["X-Contributor-Token"]);
    return replaced ? respond(200, report) : respond(201, report);
  },
  { rateLimit: limiter },
);
