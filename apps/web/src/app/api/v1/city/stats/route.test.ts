import type { CityStats } from "@krakow-bez-barier/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CityReportRecord } from "@/server/city/repository";
import { validateResponse } from "@/server/http";
import { createFakePlaceRepository, factRecord, placeRecord, sourceRecord } from "@/server/places/fake-repository";
import { seededReportsStore } from "@/server/reports/testing";

const text = (t: string) => ({ kind: "text" as const, text: t });

const sample = sourceRecord({ id: "sample", name: "Przykład", kind: "sample", baseReliability: "sample", isSample: true });

const bar = placeRecord({ name: "Bar Mleczny", category: "restaurant" });
const apteka = placeRecord({ name: "Apteka", category: "pharmacy" });
const fake = placeRecord({ name: "Kawiarnia Przykład", category: "restaurant", isSample: true });

const places = [bar, apteka, fake];
const facts = [
  factRecord(bar, "wheelchair_overall", text("no")),
  // A sample fact on a real place must not count.
  factRecord(apteka, "wheelchair_overall", text("no"), { source: sample, reliability: "sample" }),
  factRecord(fake, "wheelchair_overall", text("no")),
];
const reports: CityReportRecord[] = [
  { placeId: bar.id, status: "new" },
  { placeId: fake.id, status: "new" },
];

vi.mock("@/server/places/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/places/repository")>()),
  createDbPlaceRepository: () => createFakePlaceRepository(places, facts),
}));
vi.mock("@/server/city/repository", () => ({ dbCityReports: () => async () => reports }));
vi.mock("@/server/reports/drizzle-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/reports/drizzle-store")>()),
  reportsStore: () => seededReportsStore().store,
}));

const { GET } = await import("./route");

const url = "http://localhost/api/v1/city/stats";
const TOKEN = "city-token-0123456789";
const DEMO = "demo-token-0123456789";
let client = 0;
const get = (query = "", token: string | null = TOKEN) =>
  GET(
    new Request(`${url}${query}`, {
      headers: { "x-forwarded-for": `192.0.2.${++client}`, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    }),
  );

beforeEach(() => {
  vi.stubEnv("MODERATOR_TOKENS", `anna:${TOKEN}`);
  vi.stubEnv("MODERATOR_DEMO_TOKEN", DEMO);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /city/stats", () => {
  it("answers 401 without a moderator token", async () => {
    // GIVEN no token
    // WHEN the statistics are requested
    const res = await get("", null);

    // THEN the caller is asked for a bearer token and gets no numbers
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
  });

  it("returns spec-valid statistics from real data only, for the demo account too", async () => {
    // GIVEN the demo account's token
    // WHEN the statistics are requested
    const res = await get("", DEMO);
    const body = (await res.json()) as CityStats;

    // THEN the answer matches the spec, is not cached, and leaves out the sample place, the sample fact and its report
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(validateResponse("getCityStats", 200, body)).toEqual([]);
    expect(body.isSample).toBe(false);
    expect(body.places).toEqual({ total: 2, withData: 1, withoutData: 1 });
    expect(body.reports.find((r) => r.status === "new")?.count).toBe(1);
    // AND the bar's known barrier outranks the pharmacy we know nothing about
    expect(body.priorities.items.map((i) => [i.placeName, i.action, i.score])).toEqual([
      ["Bar Mleczny", "fix", 7],
      ["Apteka", "verify", 3],
    ]);
  });

  it("validates the ranking size", async () => {
    // GIVEN a limit above the documented maximum
    // WHEN the statistics are requested
    const res = await get("?limit=500");

    // THEN it is a 400 problem
    expect(res.status).toBe(400);
  });
});
