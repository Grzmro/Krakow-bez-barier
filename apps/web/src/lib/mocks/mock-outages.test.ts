import { beforeEach, describe, expect, it } from "vitest";
import type { Outage } from "@krakow-bez-barier/contracts";
import { mockGetPlace, mockListPlaces } from "./mock-api";
import { mockOutagesOf, resetMockOutages, withOutageMocks } from "./mock-outages";

const PLACE = "hotel-przyklad";
const fallback = async () => new Response(null, { status: 501 });
const fetchMock = withOutageMocks(fallback, (id) => mockGetPlace(id) !== null);

const post = (path: string, body: unknown) =>
  fetchMock(
    new Request(`http://localhost/api/v1${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );

beforeEach(() => resetMockOutages());

describe("outage mocks (example-data mode)", () => {
  it("lists a reported outage on the card and in the list verdict until someone says it works", async () => {
    // GIVEN a sample place that meets the wheelchair profile
    expect(mockGetPlace(PLACE, { profile: "wheelchair" })?.verdict?.state).toBe("met");

    // WHEN its lift is reported broken
    const reported = await post(`/places/${PLACE}/outages`, { equipment: "lift" });
    const outage: Outage = await reported.json();

    // THEN the card lists it and both verdicts count it as an unconfirmed barrier
    expect(reported.status).toBe(201);
    expect(mockOutagesOf(PLACE).map((o) => o.id)).toEqual([outage.id]);
    expect(mockGetPlace(PLACE, { profile: "wheelchair" })?.verdict).toMatchObject({ state: "barrier", unconfirmed: true });
    const listed = mockListPlaces({ profile: "wheelchair" }).items.find((p) => p.id === PLACE);
    expect(listed?.verdict).toMatchObject({ state: "barrier", unconfirmed: true });

    // WHEN another visitor confirms it, then someone says it works
    const confirmed = await post(`/places/${PLACE}/outages/${outage.id}/votes`, { vote: "still_broken" });
    const working = await post(`/places/${PLACE}/outages/${outage.id}/votes`, { vote: "working" });

    // THEN it was counted, then resolved and gone from the card; a late vote is refused
    expect(await confirmed.json()).toMatchObject({ confirmations: 1 });
    expect(await working.json()).toMatchObject({ state: "resolved" });
    expect(mockGetPlace(PLACE)?.outages).toEqual([]);
    expect((await post(`/places/${PLACE}/outages/${outage.id}/votes`, { vote: "working" })).status).toBe(409);
  });

  it("answers 404 for an unknown place and passes other requests on", async () => {
    // GIVEN the mock
    // WHEN reporting for a place that isn't in the examples, and reading something else
    const missing = await post("/places/nie-ma/outages", { equipment: "lift" });
    const other = await fetchMock(new Request("http://localhost/api/v1/sources"));
    // THEN the first is 404 and the second reaches the fallback
    expect([missing.status, other.status]).toEqual([404, 501]);
  });
});
