import type { ModerationReport, Problem } from "@krakow-bez-barier/contracts";
import { cityStats } from "@/domain/city-stats";
import { EXAMPLE_PLACES } from "./mock-api";

// In-browser stand-in for `GET /city/stats` in the example-data mode: the same aggregation the API runs, over the
// spec's example places and the mock moderation queue (shared, so a decision in the panel shows up here too).

type Fetch = (input: Request) => Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": status < 400 ? "application/json" : "application/problem+json" },
  });

const unauthorized: Problem = {
  type: "about:blank",
  title: "Unauthorized",
  status: 401,
  detail: "A valid moderator token is required.",
};

/** Answers `GET /city/stats` from the examples; any bearer token signs in, as in the moderation mock. */
export function withCityMocks(fallback: Fetch, reports: ModerationReport[]): Fetch {
  return async (input) => {
    const url = new URL(input.url, "http://mock.local");
    if (url.pathname.replace(/^.*\/api\/v1/, "") !== "/city/stats" || input.method !== "GET") return fallback(input);
    if (!/^Bearer\s+\S/i.test(input.headers.get("authorization") ?? "")) return json(unauthorized, 401);

    const limit = Number(url.searchParams.get("limit") ?? 25);
    const places = EXAMPLE_PLACES.map(({ id, name, category, location, attributes }) => ({
      id,
      name,
      category,
      location,
      attributes,
      reports: reports.filter((r) => r.placeId === id),
    }));
    return json(cityStats(places, { limit, isSample: true }));
  };
}
