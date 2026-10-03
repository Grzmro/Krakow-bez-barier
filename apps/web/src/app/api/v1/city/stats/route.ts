import { getCityStats } from "@/server/city/service";
import { defineRoute, respond } from "@/server/http";
import { authenticateModerator, reportsStore, revertDemoDecisionsIfDue, type ModeratorPrincipal } from "@/server/reports";

export const GET = defineRoute<"getCityStats", ModeratorPrincipal>(
  "getCityStats",
  async ({ query }) => {
    await revertDemoDecisionsIfDue(reportsStore());
    // `limit` has a spec default, so validation always sets it.
    return respond(200, await getCityStats({ limit: query.limit as number }), { "cache-control": "no-store" });
  },
  { auth: (request) => authenticateModerator(request) },
);
