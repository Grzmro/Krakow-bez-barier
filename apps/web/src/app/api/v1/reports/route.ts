import { createRateLimiter, defineRoute, respond } from "@/server/http";
import { createReport, reportsStore } from "@/server/reports";

// Per client ("na sesję i adres", US-4.5); held in memory only, nothing about the client is stored.
const limiter = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

export const POST = defineRoute(
  "createReport",
  async ({ body }) => respond(201, await createReport(reportsStore(), body)),
  { rateLimit: limiter },
);
