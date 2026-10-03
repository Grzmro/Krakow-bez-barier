import { createRateLimiter, defineRoute, respond } from "@/server/http";
import { listSources } from "@/server/sources";

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export const GET = defineRoute(
  "listSources",
  async () => respond(200, { items: await listSources() }, { "cache-control": "no-store" }),
  { rateLimit: limiter },
);
