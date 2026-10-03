import { expect, test } from "./fixtures";

test("the public API is documented at /api/docs and readable from any origin with its data licence", async ({ request }) => {
  // GIVEN the running app
  // WHEN the docs, the spec and a read endpoint are requested
  const docs = await request.get("/api/docs");
  const spec = await request.get("/api/openapi.json");
  const health = await request.get("/api/v1/health");

  // THEN docs and spec are served, and reads carry CORS plus the licence and attribution
  expect(docs.status()).toBe(200);
  expect(docs.headers()["content-type"]).toContain("text/html");
  expect(await docs.text()).toContain("/api/openapi.json");
  expect(spec.status()).toBe(200);
  expect((await spec.json()).paths).toHaveProperty(["/widget/{placeId}"]);
  expect(health.headers()["access-control-allow-origin"]).toBe("*");
  const sources = await request.get("/api/v1/sources");
  expect(sources.headers()["x-data-attribution"]).toContain("OpenStreetMap");
  expect(health.headers()["x-data-attribution"]).toBeUndefined();
});

test("moderation and reports are not opened to other origins", async ({ request }) => {
  // GIVEN the running app
  // WHEN write and moderation endpoints are requested
  const responses = await Promise.all([
    request.get("/api/v1/moderation/reports"),
    request.post("/api/v1/reports", { data: {} }),
    request.post("/api/v1/places/x/confirmations", { data: {} }),
    request.fetch("/api/v1/reports", { method: "OPTIONS" }),
  ]);

  // THEN none of them grants cross-origin access
  for (const res of responses) expect(res.headers()["access-control-allow-origin"]).toBeUndefined();
});
