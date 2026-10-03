import type { FeatureFilter, GetPlaceQuery, Problem, Profile } from "@krakow-bez-barier/contracts";
import { THRESHOLD_FLAGS, type ThresholdFlag } from "@/server/domain/profiles";
import { mockGetPlace, mockListPlaces } from "./mock-api";

// Profile-aware `/places` mocks for the example-data mode (NEXT_PUBLIC_API_MOCK). Everything else
// falls through to the generic spec-examples mock from packages/contracts.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": status < 400 ? "application/json" : "application/problem+json" },
  });

function problem(status: number, title: string, detail?: string) {
  return json({ type: "about:blank", title, status, detail } satisfies Problem, status);
}

function profileParams(params: URLSearchParams): GetPlaceQuery {
  const number = (key: string) => (params.has(key) ? Number(params.get(key)) : undefined);
  const flag = (key: string) => (params.has(key) ? params.get(key) === "true" : undefined);
  return {
    profile: (params.get("profile") as Profile | null) ?? undefined,
    maxThresholdCm: number("maxThresholdCm"),
    minDoorWidthCm: number("minDoorWidthCm"),
    ...(Object.fromEntries(THRESHOLD_FLAGS.map((key) => [key, flag(key)])) as Pick<GetPlaceQuery, ThresholdFlag>),
  };
}

type Fetch = (input: Request) => Promise<Response>;

/**
 * Wraps a mock `fetch`: answers `GET /places` and `GET /places/{id}` with search and verdicts, dates new reports and
 * confirmations now, delegates the rest.
 */
export const withPlacesMocks = (fallback: Fetch): Fetch => async (input) => {
  const url = new URL(input.url, "http://mock.local");
  const path = url.pathname.replace(/^.*\/api\/v1/, "");
  const params = url.searchParams;

  if (input.method === "GET" && path === "/places") {
    // openapi-fetch explodes arrays (`bbox=1&bbox=2…`); the spec's form style joins them with commas. Accept both.
    const list = (key: string) => {
      const values = params.getAll(key).flatMap((v) => v.split(",").filter(Boolean));
      return values.length ? values : undefined;
    };
    const bbox = list("bbox")?.map(Number);
    return json(
      mockListPlaces({
        q: params.get("q") ?? undefined,
        category: list("category"),
        feature: list("feature") as FeatureFilter[] | undefined,
        includeUnknown: params.has("includeUnknown") ? params.get("includeUnknown") === "true" : undefined,
        bbox: bbox?.length === 4 ? bbox : undefined,
        ...profileParams(params),
      }),
    );
  }

  const place = path.match(/^\/places\/([^/]+)$/);
  if (input.method === "GET" && place) {
    const id = decodeURIComponent(place[1]);
    const body = mockGetPlace(id, profileParams(params));
    return body ? json(body) : problem(404, "Not found", `Place "${id}" does not exist.`);
  }

  // The spec example carries a fixed date; a report sent now must not show it as its own.
  if (input.method === "POST" && (path === "/reports" || /^\/places\/[^/]+\/confirmations$/.test(path))) {
    const response = await fallback(input);
    if (!response.ok) return response;
    return json({ ...(await response.json()), createdAt: new Date().toISOString() }, response.status);
  }

  return fallback(input);
};
