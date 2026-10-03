import { describe, expect, it } from "vitest";
import { createApiClient, createMockFetch } from "@krakow-bez-barier/contracts";
import { matchFeature } from "@/lib/place-features";
import { mockGetPlace, mockListPlaces } from "./mock-api";
import { withPlacesMocks } from "./mock-fetch";

const ids = (list: { items: { id: string }[] }) => list.items.map((item) => item.id);

describe("mockListPlaces", () => {
  it("labels chips in English like the API, and drops Polish labels it can't translate", () => {
    // GIVEN the examples, whose chip labels are written in Polish
    // WHEN listing in English
    const result = mockListPlaces({}, "en");
    const labels = (id: string) => result.items.find((p) => p.id === id)?.summary.map((chip) => chip.label);

    // THEN a place with facts gets English labels, and a list-only example falls back to no label
    expect(labels("sukiennice")).toEqual(["Step-free entrance", "Lift", "Accessible toilet: no data"]);
    expect(labels("bistro-przyklad")).toEqual([undefined, undefined]);
  });

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
    expect(known.items.every((item) => matchFeature(item, "lift") === "met")).toBe(true);
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

  it("orders by distance from `near`, nearest first", () => {
    // GIVEN the Planty toilet's own coordinates as the point
    const toilet = mockListPlaces({ bbox: [19.9405, 50.065, 19.9415, 50.066] }).items[0];

    // WHEN listing near it
    const result = mockListPlaces({ near: toilet.location.coordinates });

    // THEN it comes first
    expect(ids(result)[0]).toBe("toaleta-planty-przyklad");
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
    expect(data?.items.every((item) => matchFeature(item, "step_free") === "met")).toBe(true);
  });
});

describe("mock places API", () => {
  it("adds verdicts only when a profile is requested", () => {
    // GIVEN the spec examples
    // WHEN listing without and with a profile
    const plain = mockListPlaces();
    const withProfile = mockListPlaces({ profile: "wheelchair" });
    // THEN only the profiled list carries verdicts, and every example place is listed
    expect(plain.items.every((p) => p.verdict === null)).toBe(true);
    expect(withProfile.items.every((p) => p.verdict)).toBe(true);
    expect(withProfile.total).toBe(withProfile.items.length);
  });

  it("never gives the no-data and conflict examples a met verdict", () => {
    // GIVEN the demo cases from the spec
    // WHEN each is read with either profile
    for (const profile of ["wheelchair", "stroller"] as const) {
      // THEN neither is met
      expect(mockGetPlace("kawiarnia-przyklad", { profile })?.verdict?.state).not.toBe("met");
      expect(mockGetPlace("palac-krzysztofory", { profile })?.verdict?.state).not.toBe("met");
    }
  });

  it("matches the verdicts the spec examples document", () => {
    // GIVEN the examples written for the wheelchair presets
    // WHEN they are read with the wheelchair profile
    // THEN the mock agrees with the spec
    expect(mockGetPlace("hotel-przyklad", { profile: "wheelchair" })?.verdict).toMatchObject({ state: "met", unconfirmed: true });
    expect(mockGetPlace("restauracja-przyklad", { profile: "wheelchair" })?.verdict?.state).toBe("barrier");
  });

  it("filters by text ignoring Polish diacritics and keeps unknown ids out", () => {
    // GIVEN a query typed without diacritics
    // WHEN listing
    const result = mockListPlaces({ q: "palac" });
    // THEN Pałac Krzysztofory is found, and an unknown id is not
    expect(result.items.map((p) => p.id)).toEqual(["palac-krzysztofory"]);
    expect(mockGetPlace("nie-ma")).toBeNull();
  });
});
