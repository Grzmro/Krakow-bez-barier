import { defineRoute, respond } from "@/server/http";
import {
  authenticateModerator,
  decideReport,
  listModerationQueue,
  moderatorSession,
  reportsStore,
  revertDemoDecisionsIfDue,
} from "@/server/reports";

const noStore = { "cache-control": "no-store" };

const auth = (request: Request) => authenticateModerator(request);

export const GET = defineRoute(
  "listModerationReports",
  async ({ query, principal }) => {
    const store = reportsStore();
    await revertDemoDecisionsIfDue(store);
    // `limit` has a spec default, so validation always sets it.
    const page = await listModerationQueue(store, { ...query, limit: query.limit as number });
    return respond(200, { ...page, moderator: moderatorSession(principal) }, noStore);
  },
  { auth },
);

export const POST = defineRoute(
  "decideModerationReport",
  async ({ body, principal }) => {
    const store = reportsStore();
    await revertDemoDecisionsIfDue(store);
    return respond(200, await decideReport(store, body, principal), noStore);
  },
  { auth },
);
