import { localeOf } from "@/i18n/locale";
import { createRateLimiter, defineRoute, HttpError, respond } from "@/server/http";
import { getWidgetCard } from "@/server/widget";

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export const GET = defineRoute(
  "getWidgetCard",
  async ({ path, query, request }) => {
    const card = await getWidgetCard(path.placeId, query, { locale: localeOf(request) });
    if (!card) throw new HttpError(404, { detail: `Place "${path.placeId}" does not exist.` });
    return respond(200, card);
  },
  { rateLimit: limiter },
);
