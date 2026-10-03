import { describe, expect, it } from "vitest";
import { withPlacesMocks } from "./mock-fetch";

const EXAMPLE_DATE = "2026-10-03T09:12:00Z";
const exampleFetch = async () =>
  new Response(JSON.stringify({ id: "r1", status: "new", createdAt: EXAMPLE_DATE }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });

describe("withPlacesMocks", () => {
  it.each(["/api/v1/reports", "/api/v1/places/p1/confirmations"])("dates a new %s now, not with the example date", async (path) => {
    // GIVEN a fallback that answers with the spec example's fixed date
    const fetch = withPlacesMocks(exampleFetch);
    const before = Date.now();

    // WHEN posting
    const response = await fetch(new Request(`http://mock.local${path}`, { method: "POST", body: "{}" }));

    // THEN the status and other fields are kept and createdAt is the current time
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.id).toBe("r1");
    expect(Date.parse(body.createdAt)).toBeGreaterThanOrEqual(before);
  });
});
