import { describe, expect, it } from "vitest";
import { GET as docs } from "./route";
import { GET as spec } from "../openapi.json/route";
import { publicApiRoutes } from "../../../../next.config";

describe("public API docs", () => {
  it("serves the Scalar reference pointing at the spec, with the script pinned by hash", async () => {
    // GIVEN the docs route
    // WHEN it is read
    const res = docs();
    const html = await res.text();

    // THEN it is HTML that loads the spec from /api/openapi.json and pins the script
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(html).toContain('data-url="/api/openapi.json"');
    expect(html).toMatch(/@scalar\/api-reference@\d+\.\d+\.\d+/);
    expect(html).toMatch(/integrity="sha384-[A-Za-z0-9+/=]+"/);
  });

  it("serves the OpenAPI document with every public operation", async () => {
    // GIVEN the spec route
    // WHEN it is read
    const body = await spec().json();

    // THEN it is OpenAPI 3.1 and lists the read endpoints
    expect(body.openapi).toMatch(/^3\.1/);
    for (const path of ["/places", "/places/{id}", "/sources", "/categories", "/widget/{placeId}"]) {
      expect(body.paths).toHaveProperty([path]);
    }
  });

  const grants = (path: string) =>
    publicApiRoutes.find((r) => new RegExp(`^${r.source.replace(/:[a-zA-Z]+/g, "[^/]+")}$`).test(path));
  const header = (path: string, key: string) => grants(path)?.headers.find((h) => h.key === key)?.value;

  it("opens only the read endpoints to other origins, never writes, reports or moderation", () => {
    // GIVEN the per-path header rules of the public API
    // WHEN matching read and write paths against them
    const open = ["/api/v1/places", "/api/v1/places/abc", "/api/v1/sources", "/api/v1/widget/abc", "/api/v1/categories", "/api/v1/health", "/api/openapi.json"];
    const closed = ["/api/v1/reports", "/api/v1/places/abc/confirmations", "/api/v1/moderation/reports", "/api/v1/moderation/reports/1"];

    // THEN every read path grants GET-only CORS and every write or moderation path matches nothing
    for (const path of open) {
      expect(header(path, "Access-Control-Allow-Origin")).toBe("*");
      expect(header(path, "Access-Control-Allow-Methods")).not.toMatch(/POST|PUT|PATCH|DELETE/);
    }
    for (const path of closed) expect(grants(path)).toBeUndefined();
  });

  it("states per source that OSM data is under ODbL on data endpoints only", () => {
    // GIVEN data and non-data read paths
    // THEN data endpoints carry the attribution, pointing at the per-source licences; the spec and health don't
    for (const path of ["/api/v1/places", "/api/v1/places/abc", "/api/v1/widget/abc", "/api/v1/sources"]) {
      expect(header(path, "X-Data-Attribution")).toMatch(/OpenStreetMap.*ODbL.*\/api\/v1\/sources/);
    }
    for (const path of ["/api/v1/health", "/api/v1/categories", "/api/openapi.json"]) {
      expect(header(path, "X-Data-Attribution")).toBeUndefined();
    }
  });
});
