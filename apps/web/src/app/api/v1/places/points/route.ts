import { localeOf } from "@/i18n/locale";
import { createRateLimiter, defineRoute, HttpError, respond } from "@/server/http";
import { InvalidQueryError, listPlacePoints } from "@/server/places/service";

// A map pans in steps of a viewport; each step that leaves the cached area is one request.
const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export const GET = defineRoute(
  "listPlacePoints",
  async ({ query, request }) => {
    try {
      return respond(200, await listPlacePoints(query, { locale: localeOf(request) }));
    } catch (error) {
      if (error instanceof InvalidQueryError) {
        throw new HttpError(400, {
          detail: `Query parameter "${error.field.replace(/^query\./, "")}" ${error.message}.`,
          errors: [{ field: error.field, message: error.message }],
        });
      }
      throw error;
    }
  },
  { rateLimit: limiter },
);
