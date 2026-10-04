import type { DataQualityReport } from "@krakow-bez-barier/contracts";
import { describe, expect, it, vi } from "vitest";
import { validateResponse } from "@/server/http";
import { createFakePlaceRepository, factRecord, placeRecord, sourceRecord } from "@/server/places/fake-repository";

const text = (t: string) => ({ kind: "text" as const, text: t });

const sample = sourceRecord({ id: "sample", name: "Przykład", kind: "sample", baseReliability: "sample", isSample: true });

const bar = placeRecord({ name: "Bar Mleczny", category: "restaurant" });
const apteka = placeRecord({ name: "Apteka", category: "pharmacy" });
const fake = placeRecord({ name: "Kawiarnia Przykład", category: "restaurant", isSample: true });
// Bulk city data hidden on the map, left out as in the city panel.
const stop = placeRecord({ name: "Rondo Mogilskie", category: "transit_stop" });

const places = [bar, apteka, fake, stop];
const facts = [
  factRecord(bar, "wheelchair_overall", text("no")),
  // A sample fact on a real place must not count.
  factRecord(apteka, "wheelchair_overall", text("no"), { source: sample, reliability: "sample" }),
  factRecord(fake, "wheelchair_overall", text("no")),
  factRecord(stop, "wheelchair_overall", text("no")),
];

vi.mock("@/server/places/repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/places/repository")>()),
  createDbPlaceRepository: () => createFakePlaceRepository(places, facts),
}));

const { GET } = await import("./route");

describe("GET /api/v1/data-quality", () => {
  it("measures real places only, answers the documented shape and needs no token", async () => {
    // GIVEN a real place with a fact, one whose only fact is a sample, a sample place and a hidden-category stop
    // WHEN the report is requested without credentials
    const res = await GET(new Request("http://localhost/api/v1/data-quality", { headers: { "x-forwarded-for": "10.0.0.1" } }));

    // THEN the body matches the spec and counts the two real places, one of them without data
    expect(res.status).toBe(200);
    const body = (await res.json()) as DataQualityReport;
    expect(validateResponse("getDataQuality", 200, body)).toEqual([]);
    expect(body.places).toEqual({ total: 2, withData: 1, withoutData: 1 });
    expect(body.isSample).toBe(false);
    expect(body.facts.total).toBe(1);
    expect(body.sources.map((s) => s.kind)).not.toContain("sample");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
