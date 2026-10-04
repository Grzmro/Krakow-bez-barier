import { defineRoute, respond } from "@/server/http";
import { authenticateModerator, moderatorSession } from "@/server/reports";
import { listSimulations, SIMULATION_MINUTES, sourceOutagesStore } from "@/server/source-outages";

const auth = (request: Request) => authenticateModerator(request);

export const GET = defineRoute(
  "listSimulatedSourceOutages",
  async ({ principal }) => {
    const items = await listSimulations(sourceOutagesStore());
    return respond(
      200,
      { items, durationMinutes: SIMULATION_MINUTES, moderator: moderatorSession(principal) },
      { "cache-control": "no-store" },
    );
  },
  { auth },
);
