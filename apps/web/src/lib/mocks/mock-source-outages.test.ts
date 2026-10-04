import { beforeEach, describe, expect, it } from "vitest";
import type { Place, Source } from "@krakow-bez-barier/contracts";
import { mockApiFetch } from "./index";
import { MOCK_DEMO_TOKEN } from "./mock-moderation";
import { resetMockSourceOutages } from "./mock-source-outages";

const call = (path: string, method = "GET", token: string | null = MOCK_DEMO_TOKEN) =>
  mockApiFetch(
    new Request(`http://localhost/api/v1${path}`, { method, headers: token ? { authorization: `Bearer ${token}` } : {} }),
  );

beforeEach(() => resetMockSourceOutages());

describe("example-data source outage switch", () => {
  it("switches a source into a demo outage on /sources and on the place card, then back", async () => {
    // GIVEN the demo account
    // WHEN it switches on the OpenStreetMap outage
    const started = await call("/moderation/source-outages/osm", "PUT");

    // THEN the switch runs, the source list and the palace card show OSM failed, its facts kept but stale
    expect(started.status).toBe(200);
    expect(await started.json()).toMatchObject({ sourceId: "osm", startedBy: "Konto demonstracyjne", stoppedAt: null });
    const sources = (await (await call("/sources", "GET", null)).json()).items as Source[];
    expect(sources.find((s) => s.id === "osm")).toMatchObject({ refreshStatus: "outage", simulatedOutage: true });
    const place = (await (await call("/places/palac-krzysztofory", "GET", null)).json()) as Place;
    expect(place.sources.find((s) => s.id === "osm")).toMatchObject({ refreshStatus: "outage", simulatedOutage: true });
    const osmFacts = place.attributes.flatMap((a) => a.facts).filter((f) => f.source.id === "osm");
    expect(osmFacts.length).toBeGreaterThan(0);
    expect(osmFacts.every((f) => f.stale)).toBe(true);

    // WHEN it is switched off
    const stopped = await call("/moderation/source-outages/osm", "DELETE");

    // THEN OSM is back to its own status
    expect(stopped.status).toBe(200);
    const after = (await (await call("/sources", "GET", null)).json()).items as Source[];
    expect(after.find((s) => s.id === "osm")?.refreshStatus).toBe("ok");
  });

  it("refuses without a token and for an unknown source", async () => {
    // GIVEN no token, and an unknown source
    // WHEN switching on
    const anonymous = await call("/moderation/source-outages/osm", "PUT", null);
    const unknown = await call("/moderation/source-outages/nope", "PUT");

    // THEN 401 and 404
    expect(anonymous.status).toBe(401);
    expect(unknown.status).toBe(404);
  });
});
