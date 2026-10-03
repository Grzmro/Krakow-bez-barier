import type { Problem } from "@krakow-bez-barier/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getOperation } from "./openapi";
import { HttpError } from "./problem";
import { createRateLimiter } from "./rate-limit";
import { defineRoute, respond, type ApiRequest } from "./route";

const BASE = "http://localhost/api/v1";

afterEach(() => {
  vi.restoreAllMocks();
});

const emptyPlaces = { items: [], nextCursor: null, total: 0 };

function listPlaces(spy?: (input: ApiRequest<"listPlaces">) => void) {
  return defineRoute("listPlaces", async (input) => {
    spy?.(input);
    return respond(200, emptyPlaces);
  });
}

const validReport = {
  placeId: "palac-krzysztofory",
  attribute: "step_count",
  value: { kind: "number", number: 2, unit: "count" },
};

const createReport = defineRoute("createReport", async ({ body }) => {
  throw new HttpError(422, { detail: `got ${body.attribute}` });
});

function post(body: string, contentType = "application/json") {
  return new Request(`${BASE}/reports`, { method: "POST", body, headers: { "content-type": contentType } });
}

describe("defineRoute — request validation", () => {
  it("rejects a query parameter outside the spec with a 400 Problem naming the field", async () => {
    // GIVEN the listPlaces route
    const GET = listPlaces();

    // WHEN limit is above the documented maximum
    const res = await GET(new Request(`${BASE}/places?limit=1000`));

    // THEN it answers 400 application/problem+json with the field in errors[]
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    const problem: Problem = await res.json();
    expect(problem).toMatchObject({ status: 400, title: "Bad request" });
    expect(problem.errors).toEqual([expect.objectContaining({ field: "query.limit" })]);
  });

  it("rejects a value outside a spec enum", async () => {
    // GIVEN the listPlaces route
    const GET = listPlaces();

    // WHEN a category is not in the Category enum
    const res = await GET(new Request(`${BASE}/places?category=museum,casino`));

    // THEN the offending array item is reported
    expect(res.status).toBe(400);
    const problem: Problem = await res.json();
    expect(problem.errors?.map((e) => e.field)).toContain("query.category.1");
  });

  it("hands the handler typed, coerced query values with spec defaults applied", async () => {
    // GIVEN a handler that records its input
    const seen = vi.fn();
    const GET = listPlaces(seen);

    // WHEN arrays come comma-separated (explode: false) and numbers as strings
    const res = await GET(new Request(`${BASE}/places?bbox=19.92,50.04,19.96,50.06&category=museum&category=toilet`));

    // THEN the handler gets numbers, arrays and defaults, and its response passes validation
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(emptyPlaces);
    expect(seen.mock.calls[0][0].query).toEqual({
      bbox: [19.92, 50.04, 19.96, 50.06],
      category: ["museum", "toilet"],
      includeUnknown: false,
      limit: 25,
    });
  });

  it("rejects a body that does not match the schema", async () => {
    // WHEN a report has no attribute and an unknown value kind
    const res = await createReport(post(JSON.stringify({ placeId: "x", value: { kind: "colour" } })));

    // THEN 400 lists the missing field
    expect(res.status).toBe(400);
    const problem: Problem = await res.json();
    expect(problem.errors?.map((e) => e.field)).toContain("body.attribute");
  });

  it("rejects malformed JSON, a non-JSON content type and a missing required body", async () => {
    // WHEN the body is broken in three different ways
    const responses = await Promise.all([
      createReport(post("{not json")),
      createReport(post(JSON.stringify(validReport), "text/plain")),
      createReport(new Request(`${BASE}/reports`, { method: "POST" })),
    ]);

    // THEN every one is a 400 Problem
    expect(responses.map((r) => r.status)).toEqual([400, 400, 400]);
  });

  it("does not coerce body types the way it coerces query strings", async () => {
    // WHEN placeId is a number and the fact value a numeric string
    const res = await createReport(
      post(JSON.stringify({ ...validReport, placeId: 123, value: { kind: "number", number: "2", unit: "count" } })),
    );

    // THEN both are rejected rather than silently converted
    expect(res.status).toBe(400);
    const problem: Problem = await res.json();
    expect(problem.errors?.map((e) => e.field)).toContain("body.placeId");
  });

  it("rejects a repeated scalar query parameter and an oversized body", async () => {
    // WHEN limit is given twice, and a report body exceeds 64 KB
    const repeated = await listPlaces()(new Request(`${BASE}/places?limit=5&limit=x`));
    const huge = await createReport(post(JSON.stringify({ ...validReport, comment: "x".repeat(70_000) })));

    // THEN neither reaches a handler
    expect(repeated.status).toBe(400);
    expect(huge.status).toBe(400);
    expect(await huge.json()).toMatchObject({ detail: expect.stringContaining("64 KB") });
  });

  it("passes a valid body through to the handler", async () => {
    // WHEN a spec-valid report is posted
    const res = await createReport(post(JSON.stringify(validReport)));

    // THEN validation lets it through and the handler's HttpError becomes that Problem
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ status: 422, detail: "got step_count" });
  });
});

describe("defineRoute — responses and errors", () => {
  it("turns a response that drifts from the spec into a 500 outside production", async () => {
    // GIVEN a handler that forgets a required field
    vi.spyOn(console, "error").mockImplementation(() => {});
    const GET = defineRoute("listPlaces", async () =>
      respond(200, { items: [], nextCursor: null } as unknown as typeof emptyPlaces),
    );

    // WHEN it is called
    const res = await GET(new Request(`${BASE}/places`));

    // THEN the drift is caught and named
    expect(res.status).toBe(500);
    const problem: Problem = await res.json();
    expect(problem.errors).toEqual([expect.objectContaining({ field: "total" })]);
  });

  it("flags a thrown problem whose status the operation does not document", async () => {
    // GIVEN a handler for an operation without a 404 response that throws one
    vi.spyOn(console, "error").mockImplementation(() => {});
    const GET = defineRoute("getHealth", async () => {
      throw new HttpError(404);
    });

    // WHEN it is called
    const res = await GET(new Request(`${BASE}/health`));

    // THEN the undocumented status surfaces as a 500 outside production
    expect(res.status).toBe(500);
    expect((await res.json()).errors).toEqual([expect.objectContaining({ field: "status" })]);
  });

  it("hides unexpected errors behind a generic 500 Problem", async () => {
    // GIVEN a handler that crashes
    vi.spyOn(console, "error").mockImplementation(() => {});
    const GET = defineRoute("listSources", async () => {
      throw new Error("connection string postgres://secret");
    });

    // WHEN it is called
    const res = await GET(new Request(`${BASE}/sources`));

    // THEN the client sees a 500 without internals
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("secret");
    expect(JSON.parse(text)).toMatchObject({ status: 500, title: "Internal server error" });
  });

  it("answers 429 with Retry-After once a client exceeds the rate limit", async () => {
    // GIVEN a limit of one request per minute
    const GET = defineRoute("listSources", async () => respond(200, { items: [] }), {
      rateLimit: createRateLimiter({ limit: 1, windowMs: 60_000 }),
    });
    const request = () => new Request(`${BASE}/sources`, { headers: { "x-forwarded-for": "203.0.113.7" } });

    // WHEN the same client calls twice
    const first = await GET(request());
    const second = await GET(request());

    // THEN the second call is a 429 Problem telling it when to retry
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBe("60");
    expect(await second.json()).toMatchObject({ status: 429, title: "Too many requests" });
  });

  it("refuses a rate limit on an operation that documents no 429", () => {
    // GIVEN an operation whose spec lists no 429 (every operation documents one today, so the compiled one is narrowed)
    const op = getOperation("getHealth");
    const documented = op.statuses;
    op.statuses = documented.filter((status) => status !== "429");

    try {
      // WHEN a limiter is attached to it
      const define = () =>
        defineRoute("getHealth", async () => respond(200, {} as never), {
          rateLimit: createRateLimiter({ limit: 1, windowMs: 1000 }),
        });

      // THEN it fails at definition time, not in production
      expect(define).toThrow(/no 429/);
    } finally {
      op.statuses = documented;
    }
  });
});
