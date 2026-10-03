import { specExamples } from "./generated/examples";
import type { operations } from "./generated/schema";

export type OperationId = keyof operations;

export type ResponseExamples = { contentType: string | null; examples: Record<string, unknown> };

export type SpecExamples = {
  basePath: string;
  operations: Record<string, { method: string; path: string; responses: Record<string, ResponseExamples> }>;
};

export type MockChoice = {
  /** Response status to return, e.g. "500". Defaults to the operation's first 2xx response. */
  status?: string;
  /** Named example to return. Defaults to the one whose `id` matches the last path parameter, then `default`, then the first. */
  example?: string;
};

export type MockFetchOptions = {
  /** Per-operation override, e.g. `{ getPlace: { example: "conflicting" }, listSources: { status: "500" } }`. */
  choose?: Partial<Record<OperationId, MockChoice>>;
  /** Artificial latency, so loading states are visible in a demo. */
  delayMs?: number;
  examples?: SpecExamples;
};

type Route = { operationId: string; method: string; pattern: RegExp; responses: Record<string, ResponseExamples> };

function compile(spec: SpecExamples): Route[] {
  return Object.entries(spec.operations).map(([operationId, op]) => ({
    operationId,
    method: op.method,
    pattern: new RegExp(`^${op.path.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{[^}]+\\?\}/g, "([^/]+)")}/?$`),
    responses: op.responses,
  }));
}

function pickExample(examples: Record<string, unknown>, params: string[], wanted?: string): unknown {
  if (wanted !== undefined) {
    if (!(wanted in examples)) throw new Error(`Mock API: no example named "${wanted}"`);
    return examples[wanted];
  }
  const id = params.at(-1);
  const byId = id && Object.values(examples).find((v) => (v as { id?: unknown } | null)?.id === id);
  if (byId) return byId;
  return "default" in examples ? examples.default : Object.values(examples)[0];
}

function problem(status: number, title: string, detail: string) {
  return new Response(JSON.stringify({ type: "about:blank", title, status, detail }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

/**
 * A `fetch` that answers API requests with the examples documented in `openapi.yaml`.
 * Pass it to `createApiClient({ fetch: createMockFetch() })` until the real endpoint exists.
 */
export function createMockFetch(options: MockFetchOptions = {}) {
  const spec = options.examples ?? specExamples;
  const routes = compile(spec);
  return async (input: Request): Promise<Response> => {
    if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));
    const { pathname } = new URL(input.url, "http://mock.invalid");
    const path = decodeURIComponent(
      pathname.startsWith(spec.basePath) ? pathname.slice(spec.basePath.length) || "/" : pathname,
    );
    for (const route of routes) {
      const match = route.method === input.method ? route.pattern.exec(path) : null;
      if (!match) continue;
      const choice = options.choose?.[route.operationId as OperationId];
      const status = choice?.status ?? Object.keys(route.responses).find((s) => s.startsWith("2"));
      const response = status ? route.responses[status] : undefined;
      if (!status || !response) {
        return problem(501, "No mock", `${route.operationId} has no response ${status ?? "2xx"} in the spec`);
      }
      const body = pickExample(response.examples, match.slice(1), choice?.example);
      if (body === undefined || response.contentType === null) return new Response(null, { status: Number(status) });
      return new Response(JSON.stringify(body), {
        status: Number(status),
        headers: { "content-type": response.contentType },
      });
    }
    return problem(404, "Not found", `No operation in the spec for ${input.method} ${path}`);
  };
}
