import { localeOf } from "@/i18n/locale";
import { isMockApi } from "@/lib/api";
import { isDbConfigured } from "@/server/db";
import { createRateLimiter, defineRoute, respond } from "@/server/http";
import { routingHttpError } from "@/server/routing/errors";
import { createDbRouteFacts } from "@/server/routing/facts-repository";
import { RoutingError } from "@/server/routing/provider";
import { createRoute } from "@/server/routing/service";

// Each request costs openrouteservice quota (free plan: 2000 directions a day); the route screen asks for two.
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

// The example-data mode runs without a database, so routes there carry only the provider's data.
const withOurFacts = () => isDbConfigured() && !isMockApi;

export const POST = defineRoute(
  "createRoute",
  async ({ body, request }) => {
    try {
      const facts = withOurFacts() ? createDbRouteFacts() : undefined;
      return respond(200, await createRoute(body, { facts, locale: localeOf(request) }));
    } catch (error) {
      if (!(error instanceof RoutingError)) throw error;
      console.error(`[routes] ${error.kind}: ${error.message}`);
      throw routingHttpError(error);
    }
  },
  { rateLimit: limiter },
);
