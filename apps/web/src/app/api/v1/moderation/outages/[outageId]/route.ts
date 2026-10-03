import { defineRoute, respond } from "@/server/http";
import { outagesStore, removeOutage } from "@/server/outages";
import { authenticateModerator } from "@/server/reports";

const auth = (request: Request) => authenticateModerator(request);

export const DELETE = defineRoute(
  "removeModerationOutage",
  async ({ path, principal }) =>
    respond(200, await removeOutage(outagesStore(), path.outageId, principal), { "cache-control": "no-store" }),
  { auth },
);
