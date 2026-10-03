import { createRateLimiter, defineRoute, HttpError, respond } from "@/server/http";
import { InvalidQueryError, listPlaces } from "@/server/places/service";

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export const GET = defineRoute(
  "listPlaces",
  async ({ query }) => {
    try {
      return respond(200, await listPlaces(query));
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
