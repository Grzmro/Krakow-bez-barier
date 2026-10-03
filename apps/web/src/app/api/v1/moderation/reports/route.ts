import { defineRoute, respond } from "@/server/http";
import { authenticateModerator, decideReport, listModerationQueue, reportsStore } from "@/server/reports";

const noStore = { "cache-control": "no-store" };

const auth = (request: Request) => authenticateModerator(request);

export const GET = defineRoute(
  "listModerationReports",
  async ({ query }) => {
    // `limit` has a spec default, so validation always sets it.
    const page = await listModerationQueue(reportsStore(), { ...query, limit: query.limit as number });
    return respond(200, page, noStore);
  },
  { auth },
);

export const POST = defineRoute(
  "decideModerationReport",
  async ({ body, principal }) => respond(200, await decideReport(reportsStore(), body, principal), noStore),
  { auth },
);
