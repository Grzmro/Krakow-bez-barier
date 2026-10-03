import type { RouteRequest } from "@krakow-bez-barier/contracts";
import { routingHttpError } from "@/server/routing/errors";
import { RoutingError } from "@/server/routing/provider";
import { createRecordedProvider } from "@/server/routing/recorded-provider";
import { createRoute } from "@/server/routing/service";

// TODO(KBB-46): delete with the rest of the mock layer once the front runs on the real API by default.
// `POST /routes` in the example-data mode: the same route service as the API, answered from openrouteservice
// responses recorded for Dworzec Główny → Rynek Główny (real data, dated by their recording). Other points get
// the "provider unavailable" problem the API sends when openrouteservice is down.

type Fetch = (input: Request) => Promise<Response>;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": status < 400 ? "application/json" : "application/problem+json" },
  });

export const withRoutesMocks = (fallback: Fetch): Fetch => async (input) => {
  const path = new URL(input.url, "http://mock.local").pathname.replace(/^.*\/api\/v1/, "");
  if (input.method !== "POST" || path !== "/routes") return fallback(input);
  const body = (await input.json()) as RouteRequest;
  try {
    return json(await createRoute(body, { provider: createRecordedProvider() }), 200);
  } catch (error) {
    if (!(error instanceof RoutingError)) throw error;
    const { problem } = routingHttpError(error);
    return json(problem, problem.status);
  }
};
