import { afterEach, describe, expect, it, vi } from "vitest";
import { validateResponse } from "@/server/http";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/v1/sources", () => {
  it("answers a documented 500 problem when no database is configured", async () => {
    // GIVEN no DATABASE_URL
    vi.stubEnv("DATABASE_URL", "");

    // WHEN sources are requested
    const res = await GET(new Request("http://localhost/api/v1/sources"));

    // THEN the app answers with a Problem, not a crash
    expect(res.status).toBe(500);
    expect(validateResponse("listSources", 500, await res.json())).toEqual([]);
  });
});
