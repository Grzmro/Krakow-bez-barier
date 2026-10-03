import { validateResponse } from "../src/server/http/openapi";
import { expect, test } from "./fixtures";

test("GET /api/v1/health answers per the spec with or without a database", async ({ request }) => {
  // GIVEN the running app (CI has no database)
  // WHEN health is requested over HTTP
  const res = await request.get("/api/v1/health");

  // THEN it is 200 JSON, uncached, and the body matches the OpenAPI schema
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/json");
  expect(res.headers()["cache-control"]).toBe("no-store");
  const body = await res.json();
  expect(validateResponse("getHealth", 200, body)).toEqual([]);
  expect(["up", "down", "not_configured"]).toContain(body.checks.database.status);
});
