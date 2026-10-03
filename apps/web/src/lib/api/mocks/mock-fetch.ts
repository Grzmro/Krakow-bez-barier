import type { Category, Problem, Profile } from "@krakow-bez-barier/contracts";
import { mockGetPlace, mockListPlaces, type GetPlaceQuery } from "./mock-api";

// TODO(KBB-28): `fetch` for the openapi-fetch client while the API isn't implemented. Add a route
// here (from the spec's examples) when a screen needs another endpoint.

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

export async function mockFetch(input: Request): Promise<Response> {
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

  return problem(501, "Not mocked", `${input.method} ${path} has no mock yet.`);
}
