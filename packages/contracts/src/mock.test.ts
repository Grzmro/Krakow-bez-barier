import { describe, expect, it } from "vitest";
import { createApiClient, responseExamples } from "./index";
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
      ["msip-toilets", "outage"],
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

  it("answers an id no example uses with the documented 404", async () => {
    // GIVEN a client backed by the mock
    const api = createApiClient({ baseUrl: BASE_URL, fetch: createMockFetch() });

    // WHEN a place no example covers is requested
    const { data, error, response } = await api.GET("/places/{id}", { params: { path: { id: "nie-ma-takiego" } } });

    // THEN it is a 404 problem, not some other place
    expect(data).toBeUndefined();
    expect(response.status).toBe(404);
    expect(error).toMatchObject({ status: 404 });
  });

  it("reaches every getPlace demo example by its own id", async () => {
    // GIVEN a client backed by the mock
    const api = createApiClient({ baseUrl: BASE_URL, fetch: createMockFetch() });

    // WHEN the source-unavailable demo place is requested
    const { data } = await api.GET("/places/{id}", { params: { path: { id: "podziemia-rynku" } } });

    // THEN its own example comes back, with the source in outage
    expect(data?.name).toBe("Podziemia Rynku");
    expect(data?.sources.map((s) => s.refreshStatus)).toEqual(["outage"]);
  });

  it("matches the widget card by placeId and 404s an unknown place", async () => {
    // GIVEN a client backed by the mock
    const api = createApiClient({ baseUrl: BASE_URL, fetch: createMockFetch() });

    // WHEN the demo hotel's widget card and an unknown place's card are requested
    const hotel = await api.GET("/widget/{placeId}", { params: { path: { placeId: "hotel-przyklad" } } });
    const missing = await api.GET("/widget/{placeId}", { params: { path: { placeId: "nie-ma-takiego" } } });

    // THEN the hotel example comes back and the unknown place is a 404, not the hotel
    expect(hotel.data?.name).toBe("Hotel Przykład");
    expect(missing.response.status).toBe(404);
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

  it("answers a malformed percent-encoded path with a 400 problem", async () => {
    // GIVEN the mock fetch
    const mockFetch = createMockFetch();

    // WHEN a path with an invalid escape is requested
    const response = await mockFetch(new Request(`${BASE_URL}/places/%E0`));

    // THEN it resolves to a problem response instead of rejecting
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
  });
});

describe("spec examples", () => {
  it("give every getPlace example its own id, so the mocks never shadow one", () => {
    // GIVEN the getPlace examples
    const ids = Object.values(responseExamples.getPlace[200]).map((place) => place.id);

    // THEN no two share an id
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("show the same facts in a widget card as on the place card with that id", () => {
    // GIVEN every widget example and the place examples by id
    const places = new Map(Object.values(responseExamples.getPlace[200]).map((p) => [p.id, p]));

    for (const card of Object.values(responseExamples.getWidgetCard[200])) {
      const place = places.get(card.placeId);
      expect(place, `no getPlace example for ${card.placeId}`).toBeDefined();

      // WHEN each widget fact is looked up on the place
      for (const fact of card.facts) {
        const attribute = place?.attributes.find((a) => a.attribute === fact.attribute);

        // THEN value, status, source and date agree
        expect({ id: card.placeId, attribute: fact.attribute, state: attribute?.state ?? "unknown" }).toEqual({
          id: card.placeId,
          attribute: fact.attribute,
          state: fact.state,
        });
        if (fact.state !== "known") continue;
        expect(attribute?.value).toEqual(fact.value);
        expect(attribute?.status).toBe(fact.status);
        const sourced = attribute?.facts.find((f) => f.source.name === fact.sourceName);
        expect(sourced, `${card.placeId}.${fact.attribute} source`).toBeDefined();
        expect(sourced?.fetchedAt).toBe(fact.fetchedAt);
        expect(sourced?.reliability).toBe(fact.reliability);
      }
    }
  });
});
