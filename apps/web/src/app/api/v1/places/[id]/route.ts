import { localeOf } from "@/i18n/locale";
import { isDbConfigured } from "@/server/db";
import { createRateLimiter, defineRoute, HttpError, respond } from "@/server/http";
import { getPlace, withPendingReports } from "@/server/places/service";
import { reportsStore, revertDemoDecisionsIfDue } from "@/server/reports";

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export const GET = defineRoute(
  "getPlace",
  async ({ path, query, request }) => {
    if (isDbConfigured()) await revertDemoDecisionsIfDue(reportsStore());
    const place = await getPlace(path.id, query, { locale: localeOf(request) });
    if (!place) throw new HttpError(404, { detail: `Place "${path.id}" does not exist.` });
    return respond(200, await withPendingReports(place, reportsStore()));
  },
  { rateLimit: limiter },
);
