import { defineRoute, respond } from "@/server/http";
import { listModerationOutages, outagesStore } from "@/server/outages";
import { authenticateModerator, moderatorSession } from "@/server/reports";

const auth = (request: Request) => authenticateModerator(request);

export const GET = defineRoute(
  "listModerationOutages",
  async ({ principal }) => {
    const items = await listModerationOutages(outagesStore());
    return respond(200, { items, moderator: moderatorSession(principal) }, { "cache-control": "no-store" });
  },
  { auth },
);
