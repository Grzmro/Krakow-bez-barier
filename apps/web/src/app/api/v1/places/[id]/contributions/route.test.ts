import type { ContributionList } from "@krakow-bez-barier/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateResponse } from "@/server/http";
import { listModerationQueue, pendingReportsByAttribute, submitReport } from "@/server/reports";
import { PLACE_ID, seededReportsStore } from "@/server/reports/testing";

let memory = seededReportsStore();
vi.mock("@/server/reports/drizzle-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/reports/drizzle-store")>()),
  reportsStore: () => memory.store,
}));

const { GET } = await import("./route");
const { DELETE } = await import("./[attribute]/route");

const TOKEN = "device-a-0123456789abcdef";
const OTHER = "device-b-0123456789abcdef";
let client = 0;
const headers = (token?: string) => ({
  "x-forwarded-for": `198.51.100.${++client}`,
  ...(token && { "x-contributor-token": token }),
});

const list = (token?: string, placeId = PLACE_ID) =>
  GET(new Request(`http://localhost/api/v1/places/${placeId}/contributions`, { headers: headers(token) }), {
    params: Promise.resolve({ id: placeId }),
  });

const withdraw = (attribute: string, token?: string) =>
  DELETE(
    new Request(`http://localhost/api/v1/places/${PLACE_ID}/contributions/${attribute}`, { method: "DELETE", headers: headers(token) }),
    { params: Promise.resolve({ id: PLACE_ID, attribute }) },
  );

const report = (token: string, broken: boolean) =>
  submitReport(memory.store, { placeId: PLACE_ID, attribute: "lift", value: { kind: "boolean", boolean: !broken } }, token);

beforeEach(() => {
  memory = seededReportsStore();
});

describe("GET /api/v1/places/{id}/contributions", () => {
  it("lists only this device's pending report, with its latest value", async () => {
    // GIVEN this device reported the lift twice and another device once
    await report(TOKEN, true);
    await report(TOKEN, false);
    await report(OTHER, true);

    // WHEN this device asks what it has pending
    const res = await list(TOKEN);

    // THEN it gets one spec-valid report with the latest value
    expect(res.status).toBe(200);
    const body: ContributionList = await res.json();
    expect(validateResponse("listMyContributions", 200, body)).toEqual([]);
    expect(body.items).toEqual([
      expect.objectContaining({ kind: "report", attribute: "lift", value: { kind: "boolean", boolean: true }, factId: null }),
    ]);
  });

  it("requires the token and answers 404 for an unknown place", async () => {
    // WHEN the token is missing, or the place is unknown
    const missing = await list();
    const unknown = await list(TOKEN, "nope");

    // THEN 400 and 404
    expect([missing.status, unknown.status]).toEqual([400, 404]);
  });
});

describe("DELETE /api/v1/places/{id}/contributions/{attribute}", () => {
  it("withdraws the device's pending report from the card and the moderation queue, leaving others", async () => {
    // GIVEN lift reports from this device and from another one
    await report(TOKEN, true);
    await report(OTHER, true);

    // WHEN this device withdraws its lift contribution
    const res = await withdraw("lift", TOKEN);

    // THEN 204, and only the other device's report is still pending and queued
    expect(res.status).toBe(204);
    expect((await pendingReportsByAttribute(memory.store, PLACE_ID)).get("lift")).toHaveLength(1);
    expect((await listModerationQueue(memory.store, { limit: 10 })).items).toHaveLength(1);
    expect(await (await list(TOKEN)).json()).toEqual({ items: [] });
    // AND the device can report the lift again as a new entry
    expect((await report(TOKEN, false)).replaced).toBe(false);
  });

  it("is idempotent and validates the attribute", async () => {
    // WHEN nothing is pending, or the attribute isn't in the vocabulary
    const nothing = await withdraw("lift", TOKEN);
    const invalid = await withdraw("colour", TOKEN);

    // THEN 204 and 400
    expect([nothing.status, invalid.status]).toEqual([204, 400]);
  });
});
