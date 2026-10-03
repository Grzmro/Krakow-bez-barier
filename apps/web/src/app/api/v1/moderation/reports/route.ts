import { defineRoute, respond } from "@/server/http";
import { authenticateModerator, decideReport, listModerationQueue, reportsStore } from "@/server/reports";

const noStore = { "cache-control": "no-store" };

export const GET = defineRoute("listModerationReports", async ({ request, query }) => {
  authenticateModerator(request);
  // `limit` has a spec default, so validation always sets it.
  const page = await listModerationQueue(reportsStore(), { ...query, limit: query.limit as number });
  return respond(200, page, noStore);
});

export const POST = defineRoute("decideModerationReport", async ({ request, body }) => {
  const moderator = authenticateModerator(request);
  return respond(200, await decideReport(reportsStore(), body, moderator), noStore);
});
