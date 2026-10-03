import { categories, toCategoryDefinition } from "@krakow-bez-barier/contracts";
import { createRateLimiter, defineRoute, respond } from "@/server/http";

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export const GET = defineRoute(
  "listCategories",
  async () => respond(200, { items: categories.map(toCategoryDefinition) }, { "cache-control": "public, max-age=300" }),
  { rateLimit: limiter },
);
