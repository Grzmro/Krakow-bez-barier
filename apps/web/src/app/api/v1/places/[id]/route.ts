import { createRateLimiter, defineRoute, HttpError, respond } from "@/server/http";
import { getPlace } from "@/server/places/service";

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export const GET = defineRoute(
  "getPlace",
  async ({ path, query }) => {
    const place = await getPlace(path.id, query);
    if (!place) throw new HttpError(404, { detail: `Place "${path.id}" does not exist.` });
    return respond(200, place);
  },
  { rateLimit: limiter },
);
