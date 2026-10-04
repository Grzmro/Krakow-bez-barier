import { createRateLimiter, defineRoute, respond } from "@/server/http";
import { reportsStore, withdrawContribution } from "@/server/reports";

const limiter = createRateLimiter({ limit: 30, windowMs: 10 * 60_000 });

export const DELETE = defineRoute(
  "withdrawContribution",
  async ({ path, header }) => {
    await withdrawContribution(reportsStore(), path.id, path.attribute, header["X-Contributor-Token"]);
    return respond(204, undefined);
  },
  { rateLimit: limiter },
);
