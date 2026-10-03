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

    // AND the stored record has no personal data fields at all
    expect(Object.keys(memory.reports[0]).sort()).toEqual(
      ["attribute", "comment", "createdAt", "decidedAt", "id", "photoUrl", "placeId", "status", "value"].sort(),
    );

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
