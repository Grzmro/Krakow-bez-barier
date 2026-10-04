import type { FeatureFilter, GetPlaceQuery, Problem, Profile } from "@krakow-bez-barier/contracts";
import { THRESHOLD_FLAGS, type ThresholdFlag } from "@/domain/profiles";
import { localeFromCookies } from "@/i18n/locale";
import { mockGetPlace, mockListPlacePoints, mockListPlaces } from "./mock-api";

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
 * Wraps a mock `fetch`: answers `GET /places` and `GET /places/{id}` with search and verdicts, delegates the rest
 * (reports and confirmations: `mock-contributions.ts`).
 */
export const withPlacesMocks = (fallback: Fetch): Fetch => async (input) => {
  const url = new URL(input.url, "http://mock.local");
  const path = url.pathname.replace(/^.*\/api\/v1/, "");
  const params = url.searchParams;
  // The real API reads the language cookie from the request; in the browser the mock reads it directly.
  const locale = localeFromCookies(typeof document === "undefined" ? null : document.cookie);

  // openapi-fetch explodes arrays (`bbox=1&bbox=2…`); the spec's form style joins them with commas. Accept both.
  const list = (key: string) => {
    const values = params.getAll(key).flatMap((v) => v.split(",").filter(Boolean));
    return values.length ? values : undefined;
  };
  const bbox = list("bbox")?.map(Number);
  const filters = {
    q: params.get("q") ?? undefined,
    category: list("category"),
    feature: list("feature") as FeatureFilter[] | undefined,
    includeUnknown: params.has("includeUnknown") ? params.get("includeUnknown") === "true" : undefined,
    bbox: bbox?.length === 4 ? bbox : undefined,
    ...profileParams(params),
  };

  if (input.method === "GET" && path === "/places") {
    const near = list("near")?.map(Number);
    return json(mockListPlaces({ ...filters, near: near?.length === 2 ? near : undefined }, locale));
  }

  if (input.method === "GET" && path === "/places/points") {
    if (!filters.bbox) return problem(400, "Bad request", 'Query parameter "bbox" is required.');
    return json(mockListPlacePoints({ ...filters, bbox: filters.bbox }, locale));
  }

  const place = path.match(/^\/places\/([^/]+)$/);
  if (input.method === "GET" && place) {
    const id = decodeURIComponent(place[1]);
    const body = mockGetPlace(id, profileParams(params), locale);
    return body ? json(body) : problem(404, "Not found", `Place "${id}" does not exist.`);
  }

  return fallback(input);
};
