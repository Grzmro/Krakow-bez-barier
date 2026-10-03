import { describe, expect, it } from "vitest";
import { createApiClient, createMockFetch } from "@krakow-bez-barier/contracts";
import { matchFeature } from "@/lib/place-features";
import { mockListPlaces } from "./mock-api";
import { withPlacesMocks } from "./mock-fetch";

const ids = (list: { items: { id: string }[] }) => list.items.map((item) => item.id);

describe("mockListPlaces", () => {
  it("finds Sukiennice by name, ignoring case and diacritics", () => {
    // GIVEN the example places
    // WHEN searching for a lower-case name
    const result = mockListPlaces({ q: "sukiennice" });

    // THEN only Sukiennice is returned and total matches the items
    expect(ids(result)).toEqual(["sukiennice"]);
    expect(result.total).toBe(1);
  });

  it("matches the Polish ł regardless of diacritics", () => {
    // GIVEN a place name with "ł"
    // WHEN searching without it
    const result = mockListPlaces({ q: "slowackiego" });

    // THEN the theatre is found
    expect(ids(result)).toEqual(["teatr-slowackiego"]);
  });

  it("hides places without data for a feature unless includeUnknown is set", () => {
    // GIVEN the lift filter
    // WHEN listing without and with includeUnknown
    const known = mockListPlaces({ feature: ["lift"] });
    const withUnknown = mockListPlaces({ feature: ["lift"], includeUnknown: true });

    // THEN only places with a known lift come back by default, unknown ones only on request
    expect(known.items.length).toBeGreaterThan(0);
    expect(known.items.every((item) => matchFeature(item.summary, "lift") === "known")).toBe(true);
    expect(ids(known)).not.toContain("palac-krzysztofory");
    expect(ids(withUnknown)).toContain("palac-krzysztofory");
  });

  it("treats conflicting data as not known", () => {
    // GIVEN Pałac Krzysztofory, whose toilet sources disagree
    // WHEN filtering on an accessible toilet
    const result = mockListPlaces({ feature: ["toilet_accessible"] });

    // THEN the palace is hidden
    expect(ids(result)).not.toContain("palac-krzysztofory");
  });

  it("keeps only places inside the bounding box", () => {
    // GIVEN a box around the Planty toilet only
    // WHEN listing inside it
    const result = mockListPlaces({ bbox: [19.9405, 50.065, 19.9415, 50.066] });

    // THEN only that place is returned
    expect(ids(result)).toEqual(["toaleta-planty-przyklad"]);
  });
});

describe("withPlacesMocks", () => {
  const api = createApiClient({ baseUrl: "http://localhost/api/v1", fetch: withPlacesMocks(createMockFetch()) });

  it("passes the home-screen query parameters through the generated client", async () => {
    // GIVEN the typed client backed by the mocks
    // WHEN listing museums and hotels with a step-free filter
    const { data, error } = await api.GET("/places", {
      params: { query: { category: ["museum", "hotel"], feature: ["step_free"] } },
    });

    // THEN only matching places with known step-free access come back
    expect(error).toBeUndefined();
    expect(data?.items.length).toBeGreaterThan(0);
    expect(data?.items.every((item) => item.category === "museum" || item.category === "hotel")).toBe(true);
    expect(data?.items.every((item) => matchFeature(item.summary, "step_free") === "known")).toBe(true);
  });
});
