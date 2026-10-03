// Reference endpoint test: call the exported handler with a plain Request, then check status, headers and
// that the body matches the spec. Copy this shape for new endpoints.
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkHealth } from "@/server/health";
import { validateResponse } from "@/server/http";
import { GET } from "./route";

const url = "http://localhost/api/v1/health";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/v1/health", () => {
  it("answers 200 with a spec-valid body when no database is configured", async () => {
    // GIVEN no DATABASE_URL
    vi.stubEnv("DATABASE_URL", "");

    // WHEN health is requested
    const res = await GET(new Request(url));

    // THEN the app reports itself up but degraded, in the shape the spec documents
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(validateResponse("getHealth", 200, body)).toEqual([]);
    expect(body).toMatchObject({ status: "degraded", checks: { database: { status: "not_configured" } } });
  });

  it("reports an unreachable database as down instead of failing", async () => {
    // GIVEN a DATABASE_URL pointing at a port nothing listens on
    vi.stubEnv("DATABASE_URL", "postgres://kbb:kbb@127.0.0.1:1/kbb");

    // WHEN health is requested
    const res = await GET(new Request(url));

    // THEN it still answers 200 and names the failure without leaking the connection string
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(validateResponse("getHealth", 200, body)).toEqual([]);
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toMatchObject({
      status: "down",
      latencyMs: null,
      detail: expect.stringContaining("ECONNREFUSED"),
    });
    expect(JSON.stringify(body)).not.toContain("kbb:kbb");
  });

  it("is ok when the database answers", async () => {
    // GIVEN a database probe that succeeds
    const probe = async () => ({ status: "up" as const, latencyMs: 3, detail: null });

    // WHEN health is computed
    const health = await checkHealth(probe);

    // THEN the overall status is ok
    expect(health.status).toBe("ok");
    expect(validateResponse("getHealth", 200, health)).toEqual([]);
  });
});
