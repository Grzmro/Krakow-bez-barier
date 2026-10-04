import { createRateLimiter, defineRoute, respond } from "@/server/http";
import { authenticateModerator } from "@/server/reports";
import { sourceOutagesStore, startSimulation, stopSimulation } from "@/server/source-outages";

const auth = (request: Request) => authenticateModerator(request);

/** Switching on and off together: 20 per client per minute. */
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

export const PUT = defineRoute(
  "startSimulatedSourceOutage",
  async ({ path, principal }) =>
    respond(200, await startSimulation(sourceOutagesStore(), path.sourceId, principal), { "cache-control": "no-store" }),
  { auth, rateLimit: limiter },
);

export const DELETE = defineRoute(
  "stopSimulatedSourceOutage",
  async ({ path, principal }) =>
    respond(200, await stopSimulation(sourceOutagesStore(), path.sourceId, principal), { "cache-control": "no-store" }),
  { auth, rateLimit: limiter },
);
