import { defineRoute, HttpError, respond } from "@/server/http";
import { outagesStore, voteOutage } from "@/server/outages";
import { outageRequests, outageVotes } from "@/server/outages/limits";

export const POST = defineRoute(
  "voteOutage",
  async ({ request, path, body }) => {
    const repeat = outageVotes.peek(request, path.outageId, body.vote);
    if (!repeat.allowed) {
      throw new HttpError(429, {
        detail: "This vote was already given from this device today.",
        headers: { "retry-after": String(repeat.retryAfterSeconds) },
      });
    }
    const outage = await voteOutage(outagesStore(), path.id, path.outageId, body);
    outageVotes.record(request, path.outageId, body.vote);
    return respond(200, outage);
  },
  { rateLimit: outageRequests },
);
