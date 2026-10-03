import { defineRoute, respond } from "@/server/http";
import { outagesStore, reportOutage } from "@/server/outages";
import { outageRequests, outageVotes } from "@/server/outages/limits";

export const POST = defineRoute(
  "reportOutage",
  async ({ request, path, body }) => {
    const { outage, created, confirmed } = await reportOutage(outagesStore(), path.id, body, {
      mayConfirm: (outageId) => outageVotes.peek(request, outageId, "still_broken").allowed,
    });
    if (created || confirmed) outageVotes.record(request, outage.id, "still_broken");
    return created ? respond(201, outage) : respond(200, outage);
  },
  { rateLimit: outageRequests },
);
