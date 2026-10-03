import type { Confirmation } from "@krakow-bez-barier/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAttribute } from "@/domain";
import { validateResponse } from "@/server/http";
import { jsonRequest, LIFT_FACT_ID, OTHER_PLACE_ID, PLACE_ID, seededReportsStore } from "@/server/reports/testing";

let memory = seededReportsStore();
vi.mock("@/server/reports/drizzle-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/reports/drizzle-store")>()),
  reportsStore: () => memory.store,
}));

const { POST } = await import("./route");

let client = 0;
const confirm = (placeId: string, factId: string, ip = `198.51.100.${++client}`) =>
  POST(jsonRequest(`http://localhost/api/v1/places/${placeId}/confirmations`, { factId }, { "x-forwarded-for": ip }), {
    params: Promise.resolve({ id: placeId }),
  });

beforeEach(() => {
  memory = seededReportsStore();
});

describe("POST /api/v1/places/{id}/confirmations", () => {
  it("makes a community fact 'confirmed by the community' after two independent confirmations", async () => {
    // GIVEN the OpenStreetMap lift fact, unverified
    const lift = () => resolveAttribute("lift", memory.facts);
    expect(lift().status).toBe("unverified");

    // WHEN one visitor confirms it
    const first = await confirm(PLACE_ID, LIFT_FACT_ID);

    // THEN the confirmation is spec-valid, the date of last confirmation is set, the status not yet raised
    expect(first.status).toBe(201);
    const body: Confirmation = await first.json();
    expect(validateResponse("createConfirmation", 201, body)).toEqual([]);
    expect(body).toMatchObject({ placeId: PLACE_ID, factId: LIFT_FACT_ID });
    expect(memory.facts[0].confirmedAt).toBe(body.createdAt);
    expect(lift()).toMatchObject({ status: "unverified" });

    // WHEN a second visitor confirms it
    const second = await confirm(PLACE_ID, LIFT_FACT_ID);

    // THEN it counts two confirmations and resolves as confirmed ("Potwierdzone przez społeczność")
    expect(second.status).toBe(201);
    expect(memory.facts[0].evidence?.confirmations).toBe(2);
    expect(lift()).toMatchObject({ state: "known", status: "confirmed" });
  });

  it("counts one confirmation per fact per client", async () => {
    // WHEN the same client confirms the same fact twice
    const first = await confirm(PLACE_ID, LIFT_FACT_ID, "203.0.113.9");
    const again = await confirm(PLACE_ID, LIFT_FACT_ID, "203.0.113.9");

    // THEN the repeat is refused and not counted
    expect([first.status, again.status]).toEqual([201, 429]);
    expect(again.headers.get("retry-after")).toBeTruthy();
    expect(memory.confirmations).toHaveLength(1);
  });

  it("answers 404 for an unknown place or a fact of another place", async () => {
    // WHEN the place is unknown, or the fact belongs to a different place
    const unknownPlace = await confirm("nope", LIFT_FACT_ID);
    const wrongPlace = await confirm(OTHER_PLACE_ID, LIFT_FACT_ID);

    // THEN both are 404 and nothing is recorded
    expect([unknownPlace.status, wrongPlace.status]).toEqual([404, 404]);
    expect(memory.confirmations).toHaveLength(0);
  });
});
