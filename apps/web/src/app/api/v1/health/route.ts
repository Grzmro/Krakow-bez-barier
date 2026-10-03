import { checkHealth } from "@/server/health";
import { createRateLimiter, defineRoute, respond } from "@/server/http";

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export const GET = defineRoute(
  "getHealth",
  async () => respond(200, await checkHealth(), { "cache-control": "no-store" }),
  { rateLimit: limiter },
);
