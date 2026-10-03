import { describe, expect, it } from "vitest";
import { createApiClient } from "./index";
import { createMockFetch } from "./mock";

const BASE_URL = "http://localhost/api/v1";

describe("createMockFetch", () => {
  it("answers an operation with its default spec example", async () => {
    // GIVEN a client backed by the mock
    const api = createApiClient({ baseUrl: BASE_URL, fetch: createMockFetch() });

    // WHEN the sources are listed
    const { data, response } = await api.GET("/sources");

    // THEN the example from openapi.yaml comes back, including the unavailable source
    expect(response.status).toBe(200);
    expect(data?.items.map((s) => [s.id, s.refreshStatus])).toEqual([
      ["osm", "ok"],
      ["ziw", "outage"],
    ]);
  });

  it("prefers the example whose id matches the path parameter", async () => {
    // GIVEN a client backed by the mock
    const api = createApiClient({ baseUrl: BASE_URL, fetch: createMockFetch() });

    // WHEN a place is requested by an id that one example uses
    const { data } = await api.GET("/places/{id}", { params: { path: { id: "teatr-slowackiego" } } });

    // THEN that example is returned
    expect(data?.id).toBe("teatr-slowackiego");
  });

  it("returns a chosen example or error status per operation", async () => {
    // GIVEN overrides for two operations
    const api = createApiClient({
      baseUrl: BASE_URL,
      fetch: createMockFetch({ choose: { getPlace: { example: "noData" }, listSources: { status: "500" } } }),
    });

    // WHEN both are called
    const place = await api.GET("/places/{id}", { params: { path: { id: "anything" } } });
    const sources = await api.GET("/sources");

    // THEN the chosen example and the documented problem response are returned
    expect(place.data?.id).toBe("kawiarnia-przyklad");
    expect(sources.response.status).toBe(500);
    expect(sources.response.headers.get("content-type")).toBe("application/problem+json");
    expect(sources.error).toMatchObject({ status: 500 });
  });

  it("returns 404 for a path the spec does not define", async () => {
    // GIVEN the mock fetch
    const mockFetch = createMockFetch();

    // WHEN an unknown path is requested
    const response = await mockFetch(new Request(`${BASE_URL}/nope`));

    // THEN it answers with a problem
    expect(response.status).toBe(404);
  });
});
