import { localeOf } from "@/i18n/locale";
import { createRateLimiter, defineRoute, respond } from "@/server/http";
import { currentSimulatedOutageIds } from "@/server/source-outages";
import { listSources } from "@/server/sources";

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export const GET = defineRoute(
  "listSources",
  async ({ request }) => {
    const items = await listSources(undefined, undefined, await currentSimulatedOutageIds(), localeOf(request));
    return respond(200, { items }, { "cache-control": "no-store" });
  },
  { rateLimit: limiter },
);
