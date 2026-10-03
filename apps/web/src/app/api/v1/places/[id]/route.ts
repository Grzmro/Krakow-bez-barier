import { localeOf } from "@/i18n/locale";
import { createRateLimiter, defineRoute, HttpError, respond } from "@/server/http";
import { getPlace, withPendingReports } from "@/server/places/service";
import { reportsStore } from "@/server/reports";

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export const GET = defineRoute(
  "getPlace",
  async ({ path, query, request }) => {
    const place = await getPlace(path.id, query, { locale: localeOf(request) });
    if (!place) throw new HttpError(404, { detail: `Place "${path.id}" does not exist.` });
    return respond(200, await withPendingReports(place, reportsStore()));
  },
  { rateLimit: limiter },
);
