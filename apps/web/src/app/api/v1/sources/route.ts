import { localeOf } from "@/i18n/locale";
import { createRateLimiter, defineRoute, respond } from "@/server/http";
import { listSources } from "@/server/sources";

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export const GET = defineRoute(
  "listSources",
  async ({ request }) =>
    respond(200, { items: await listSources(undefined, undefined, undefined, localeOf(request)) }, { "cache-control": "no-store" }),
  { rateLimit: limiter },
);
