import type { Problem, Report } from "@krakow-bez-barier/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAttribute } from "@/domain";
import { validateResponse } from "@/server/http";
import { pendingReportsByAttribute } from "@/server/reports";
import { jsonRequest, PLACE_ID, seededReportsStore } from "@/server/reports/testing";

let memory = seededReportsStore();
vi.mock("@/server/reports/drizzle-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/reports/drizzle-store")>()),
  reportsStore: () => memory.store,
}));

const { POST } = await import("./route");

const url = "http://localhost/api/v1/reports";
let client = 0;
// A fresh client address per request keeps the per-client limit out of tests that aren't about it.
const post = (body: unknown, ip = `198.51.100.${++client}`) => POST(jsonRequest(url, body, { "x-forwarded-for": ip }));

beforeEach(() => {
  memory = seededReportsStore();
});

describe("POST /api/v1/reports", () => {
  it("stores an anonymous report as new, without contact data, beside the fact it does not change", async () => {
    // GIVEN a place whose lift OpenStreetMap says works
    // WHEN someone reports it broken, leaving an e-mail and a phone number in the comment
    const res = await post({
      placeId: PLACE_ID,
      attribute: "lift",
      value: { kind: "boolean", boolean: false },
      comment: "Winda nie działa. Kontakt: ola@example.com, 600 700 800",
    });

    // THEN it is created as a spec-valid `new` report with the contact data redacted
    expect(res.status).toBe(201);
    const report: Report = await res.json();
    expect(validateResponse("createReport", 201, report)).toEqual([]);
    expect(report).toMatchObject({ placeId: PLACE_ID, status: "new", decidedAt: null, photoUrl: null });
    expect(report.comment).toBe("Winda nie działa. Kontakt: [usunięto], [usunięto]");

    // AND the stored record has no personal data fields at all — sent without a token, it has no contributor either
    expect(Object.keys(memory.reports[0]).sort()).toEqual(
      ["attribute", "comment", "contributor", "createdAt", "decidedAt", "id", "photoUrl", "placeId", "status", "value", "withdrawnAt"].sort(),
    );
    expect(memory.reports[0]).toMatchObject({ contributor: null, withdrawnAt: null });

    // AND it is listed beside the value as unverified, while the resolved value stays OpenStreetMap's
    const pending = await pendingReportsByAttribute(memory.store, PLACE_ID);
    expect(pending.get("lift")).toEqual([expect.objectContaining({ id: report.id, status: "new" })]);
    expect(resolveAttribute("lift", memory.facts).value).toEqual({ kind: "boolean", boolean: true });
  });

  it("accepts a place's external reference and answers with its id", async () => {
    // WHEN the place is named by its OSM reference
    const res = await post({ placeId: "osm:way/123", attribute: "door_width_cm", value: { kind: "number", number: 90 } });

    // THEN the report is attached to that place, with the unit filled in
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ placeId: PLACE_ID, value: { kind: "number", number: 90, unit: "cm" } });
  });

  it("rejects a value outside the attribute's range with 422", async () => {
    // WHEN a door is reported 5 cm wide
    const res = await post({ placeId: PLACE_ID, attribute: "door_width_cm", value: { kind: "number", number: 5 } });

    // THEN it is a spec-valid 422 naming the field, and nothing is stored
    expect(res.status).toBe(422);
    const problem: Problem = await res.json();
    expect(validateResponse("createReport", 422, problem)).toEqual([]);
    expect(problem.detail).toContain("between 10 and 300");
    expect(problem.errors).toEqual([expect.objectContaining({ field: "value.number" })]);
    expect(memory.reports).toHaveLength(0);
  });

  it("refuses a filled honeypot and a photo URL", async () => {
    // GIVEN a valid report
    const report = { placeId: PLACE_ID, attribute: "lift", value: { kind: "boolean", boolean: false } };

    // WHEN a bot fills the hidden field, and someone sends a photo URL
    const bot = await post({ ...report, website: "http://spam.example" });
    const photo = await post({ ...report, photoUrl: "https://example.com/p.jpg" });

    // THEN both are 422 and nothing is stored
    expect([bot.status, photo.status]).toEqual([422, 422]);
    expect(memory.reports).toHaveLength(0);
  });

  it("answers 404 for an unknown place", async () => {
    // WHEN the place does not exist
    const res = await post({ placeId: "nope", attribute: "lift", value: { kind: "boolean", boolean: true } });

    // THEN 404
    expect(res.status).toBe(404);
  });

  it("limits reports per client", async () => {
    // GIVEN one client
    const report = { placeId: PLACE_ID, attribute: "bench", value: { kind: "boolean", boolean: true } };

    // WHEN it sends 11 reports in a row
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await post(report, "203.0.113.50")).status);

    // THEN the 11th is refused with 429
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe("POST /api/v1/reports with a contributor token", () => {
  const TOKEN = "device-a-0123456789abcdef";
  const lift = (broken: boolean) => ({ placeId: PLACE_ID, attribute: "lift", value: { kind: "boolean", boolean: !broken } });
  const postAs = (body: unknown, token: string) =>
    POST(jsonRequest(url, body, { "x-forwarded-for": `198.51.100.${++client}`, "x-contributor-token": token }));

  it("updates the device's pending report of the same attribute instead of adding another", async () => {
    // GIVEN a lift report from one device
    const first = await postAs(lift(true), TOKEN);
    const created: Report = await first.json();

    // WHEN the same device reports the lift again with another value
    const second = await postAs({ ...lift(false), comment: "Jednak działa." }, TOKEN);

    // THEN the answer is a spec-valid 200 with the same report, now holding the new value
    expect([first.status, second.status]).toEqual([201, 200]);
    const replaced: Report = await second.json();
    expect(validateResponse("createReport", 200, replaced)).toEqual([]);
    expect(replaced).toMatchObject({ id: created.id, value: { kind: "boolean", boolean: true }, comment: "Jednak działa.", status: "new" });
    // AND the place lists one pending lift report, and the store holds the token's hash, not the token
    expect((await pendingReportsByAttribute(memory.store, PLACE_ID)).get("lift")).toHaveLength(1);
    expect(memory.reports).toHaveLength(1);
    expect(memory.reports[0].contributor).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(memory.reports)).not.toContain(TOKEN);
  });

  it("keeps reports from different devices apart", async () => {
    // WHEN two devices report the lift
    const a = await postAs(lift(true), TOKEN);
    const b = await postAs(lift(true), "device-b-0123456789abcdef");

    // THEN both are new entries
    expect([a.status, b.status]).toEqual([201, 201]);
    expect((await pendingReportsByAttribute(memory.store, PLACE_ID)).get("lift")).toHaveLength(2);
  });

  it("refuses a malformed token with 400", async () => {
    // WHEN the token is too short
    const res = await postAs(lift(true), "short");

    // THEN it is a 400 naming the header, and nothing is stored
    expect(res.status).toBe(400);
    const problem: Problem = await res.json();
    expect(problem.errors).toEqual([expect.objectContaining({ field: "header.X-Contributor-Token" })]);
    expect(memory.reports).toHaveLength(0);
  });
});
