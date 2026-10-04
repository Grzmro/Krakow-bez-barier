import type { Confirmation } from "@krakow-bez-barier/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAttribute } from "@/domain";
import { validateResponse } from "@/server/http";
import { listContributions, listModerationQueue, pendingReportsByAttribute, submitReport } from "@/server/reports";
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

describe("POST /api/v1/places/{id}/confirmations with a contributor token", () => {
  const TOKEN = "device-a-0123456789abcdef";
  const confirmAs = (token: string, ip = `198.51.100.${++client}`) =>
    POST(
      jsonRequest(`http://localhost/api/v1/places/${PLACE_ID}/confirmations`, { factId: LIFT_FACT_ID }, {
        "x-forwarded-for": ip,
        "x-contributor-token": token,
      }),
      { params: Promise.resolve({ id: PLACE_ID }) },
    );

  it("replaces the device's pending report of the attribute: the latest one wins", async () => {
    // GIVEN the device reported the lift broken
    await submitReport(memory.store, { placeId: PLACE_ID, attribute: "lift", value: { kind: "boolean", boolean: false } }, TOKEN);

    // WHEN the same device confirms the lift works
    const res = await confirmAs(TOKEN);

    // THEN the confirmation is recorded and the report leaves the card and the moderation queue
    expect(res.status).toBe(201);
    expect((await pendingReportsByAttribute(memory.store, PLACE_ID)).get("lift")).toBeUndefined();
    expect((await listModerationQueue(memory.store, { limit: 10 })).items).toEqual([]);
    expect(await listContributions(memory.store, PLACE_ID, TOKEN)).toEqual([
      expect.objectContaining({ kind: "confirmation", attribute: "lift", factId: LIFT_FACT_ID }),
    ]);
  });

  it("returns the device's confirmation again instead of a second one or a 429", async () => {
    // GIVEN the device confirmed the lift
    const first = await confirmAs(TOKEN, "203.0.113.77");
    const confirmation: Confirmation = await first.json();

    // WHEN it confirms again from the same address
    const again = await confirmAs(TOKEN, "203.0.113.77");

    // THEN it is a spec-valid 200 with the same confirmation, counted once
    expect([first.status, again.status]).toEqual([201, 200]);
    const body: Confirmation = await again.json();
    expect(validateResponse("createConfirmation", 200, body)).toEqual([]);
    expect(body.id).toBe(confirmation.id);
    expect(memory.facts[0].evidence?.confirmations).toBe(1);
  });

  it("is withdrawn when the device then reports the attribute", async () => {
    // GIVEN the device confirmed the lift
    await confirmAs(TOKEN);

    // WHEN the same device reports the lift broken
    const { replaced } = await submitReport(
      memory.store,
      { placeId: PLACE_ID, attribute: "lift", value: { kind: "boolean", boolean: false } },
      TOKEN,
    );

    // THEN the report is new, the confirmation no longer counts and the device has only the report
    expect(replaced).toBe(false);
    expect(memory.facts[0].evidence?.confirmations).toBe(0);
    expect(await listContributions(memory.store, PLACE_ID, TOKEN)).toEqual([expect.objectContaining({ kind: "report" })]);
  });
});
