import { createRateLimiter, defineRoute, respond } from "@/server/http";
import { getDataQuality } from "@/server/data-quality/service";

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

export const GET = defineRoute(
  "getDataQuality",
  async () => respond(200, await getDataQuality(), { "cache-control": "no-store" }),
  { rateLimit: limiter },
);
