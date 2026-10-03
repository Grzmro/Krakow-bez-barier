import type { Category, GetPlaceQuery, Problem, Profile } from "@krakow-bez-barier/contracts";
import { mockGetPlace, mockListPlaces } from "./mock-api";

// TODO(KBB-28): profile-aware `/places` mocks while the API isn't implemented. Everything else
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
    requireStepFree: flag("requireStepFree"),
    requireLift: flag("requireLift"),
    requireAccessibleToilet: flag("requireAccessibleToilet"),
    requireSmoothSurface: flag("requireSmoothSurface"),
    requireChangingTable: flag("requireChangingTable"),
  };
}

type Fetch = (input: Request) => Promise<Response>;

/** Wraps a mock `fetch`: answers `GET /places` and `GET /places/{id}` with search and verdicts, delegates the rest. */
export const withPlacesMocks = (fallback: Fetch): Fetch => async (input) => {
  const url = new URL(input.url, "http://mock.local");
  const path = url.pathname.replace(/^.*\/api\/v1/, "");
  const params = url.searchParams;

  if (input.method === "GET" && path === "/places") {
    const category = params.get("category");
    return json(
      mockListPlaces({
        q: params.get("q") ?? undefined,
        category: category ? (category.split(",") as Category[]) : undefined,
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

  return fallback(input);
};
