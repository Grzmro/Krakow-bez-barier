import { validateResponse } from "../src/server/http/openapi";
import { expect, test } from "./fixtures";

test("GET /api/v1/sources answers per the spec, or a Problem when there is no database", async ({ request }) => {
  // GIVEN the running app (CI has no database)
  // WHEN the sources are requested over HTTP
  const res = await request.get("/api/v1/sources");

  // THEN the answer is uncached JSON that matches the OpenAPI schema for its status
  expect([200, 500]).toContain(res.status());
  const body = await res.json();
  expect(validateResponse("listSources", res.status(), body)).toEqual([]);
  if (res.status() === 200) expect(res.headers()["cache-control"]).toBe("no-store");
});
