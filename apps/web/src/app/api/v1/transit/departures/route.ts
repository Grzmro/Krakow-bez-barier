import { localeOf } from "@/i18n/locale";
import { createRateLimiter, defineRoute, respond } from "@/server/http";
import { getTransitService } from "@/server/transit/service";

// Generous: every place card asks once, and the feed itself is read at most every 30 s whatever the traffic.
const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export const GET = defineRoute(
  "listTransitDepartures",
  async ({ query, request }) =>
    respond(200, await getTransitService().departures(query, localeOf(request)), { "cache-control": "no-store" }),
  { rateLimit: limiter },
);
