import { createRateLimiter, defineRoute, respond } from "@/server/http";
import { listContributions, reportsStore } from "@/server/reports";

const limiter = createRateLimiter({ limit: 120, windowMs: 10 * 60_000 });

export const GET = defineRoute(
  "listMyContributions",
  async ({ path, header }) =>
    respond(200, { items: await listContributions(reportsStore(), path.id, header["X-Contributor-Token"]) }),
  { rateLimit: limiter },
);
