import { isDbConfigured } from "@/server/db";
import { createRateLimiter, defineRoute, respond } from "@/server/http";
import { routingHttpError } from "@/server/routing/errors";
import { createDbRouteFacts } from "@/server/routing/facts-repository";
import { RoutingError } from "@/server/routing/provider";
import { createRoute } from "@/server/routing/service";

// Each request costs openrouteservice quota (free plan: 2000 directions a day); the route screen asks for two.
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export const POST = defineRoute(
  "createRoute",
  async ({ body }) => {
    try {
      return respond(200, await createRoute(body, { facts: isDbConfigured() ? createDbRouteFacts() : undefined }));
    } catch (error) {
      if (!(error instanceof RoutingError)) throw error;
      console.error(`[routes] ${error.kind}: ${error.message}`);
      throw routingHttpError(error);
    }
  },
  { rateLimit: limiter },
);
