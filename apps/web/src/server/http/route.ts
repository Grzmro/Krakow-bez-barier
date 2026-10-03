import type { operations } from "@krakow-bez-barier/contracts";
import {
  getOperation,
  readQuery,
  validateRequest,
  validateResponse,
  type FieldError,
  type OperationId,
} from "./openapi";
import { HttpError, problemResponse } from "./problem";
import { clientKey, type RateLimiter } from "./rate-limit";

type Op<K extends OperationId> = operations[K];
type OrEmpty<T> = [NonNullable<T>] extends [never] ? Record<string, never> : NonNullable<T>;

export type PathParams<K extends OperationId> = OrEmpty<Op<K>["parameters"]["path"]>;
export type QueryParams<K extends OperationId> = OrEmpty<Op<K>["parameters"]["query"]>;
export type RequestBody<K extends OperationId> =
  NonNullable<Op<K>["requestBody"]> extends { content: { "application/json": infer B } } ? B : undefined;

type ResponseBody<R> = R extends { content: Record<string, infer B> } ? B : undefined;

/** What a handler returns: one of the operation's documented statuses with exactly its body type. */
export type ApiResult<K extends OperationId> = {
  [S in keyof Op<K>["responses"]]: { status: S; body: ResponseBody<Op<K>["responses"][S]>; headers?: HeadersInit };
}[keyof Op<K>["responses"]];

/**
 * Builds a handler result. Prefer it over an object literal: it keeps `status` a literal (e.g. `200`), so the
 * compiler checks `body` against that status in the spec even in a handler that takes no arguments.
 */
export function respond<const S extends number, B>(status: S, body: B, headers?: HeadersInit) {
  return { status, body, ...(headers && { headers }) };
}

export type ApiRequest<K extends OperationId> = {
  request: Request;
  path: PathParams<K>;
  query: QueryParams<K>;
  body: RequestBody<K>;
};

export type RouteOptions<P = undefined> = {
  /** Per-client limit; the operation must document a 429 response. */
  rateLimit?: RateLimiter;
  /**
   * Authenticates the caller before the request is read or validated (throw `HttpError` 401/429), so an anonymous
   * caller never learns the request shape. Its result reaches the handler as `principal`.
   */
  auth?: (request: Request) => P;
};

type HandlerContext = { params?: Promise<Record<string, string | string[] | undefined>> };

// Responses are checked against the spec everywhere except production, so drift fails tests and dev, not users.
const validateResponses = process.env.NODE_ENV !== "production";

const MAX_BODY_BYTES = 64 * 1024;

function driftResponse(operationId: OperationId, status: number, errors: FieldError[]) {
  console.error(`[api] ${operationId} answered ${status} in a way the spec does not document`, errors);
  return problemResponse(new HttpError(500, { detail: "Response does not match the API specification.", errors }).problem);
}

/**
 * Wraps a Next route handler for one spec operation: rate limit → auth → parse and validate path/query/body
 * (400 `Problem` with `errors[]`) → handler → response validation (non-production) → JSON response.
 * Throw `HttpError` for documented problems; anything else becomes a 500 `Problem`.
 */
export function defineRoute<K extends OperationId, P = undefined>(
  operationId: K,
  handler: (input: ApiRequest<K> & { principal: P }) => Promise<ApiResult<K>>,
  options: RouteOptions<P> = {},
) {
  const op = getOperation(operationId);
  if (options.rateLimit && !op.statuses.includes("429")) {
    throw new Error(`defineRoute(${operationId}): rateLimit is set but the spec documents no 429 response`);
  }

  return async function routeHandler(request: Request, context: HandlerContext = {}): Promise<Response> {
    try {
      if (request.method !== op.method && !(request.method === "HEAD" && op.method === "GET")) {
        throw new Error(`defineRoute(${operationId}) is mounted on ${request.method}, the spec says ${op.method}`);
      }

      if (options.rateLimit) {
        const decision = options.rateLimit.check(clientKey(request));
        if (!decision.allowed) {
          throw new HttpError(429, {
            detail: `Limit of ${options.rateLimit.limit} requests exceeded. Retry in ${decision.retryAfterSeconds} s.`,
            headers: { "retry-after": String(decision.retryAfterSeconds) },
          });
        }
      }

      const principal = options.auth?.(request) as P;

      const input = {
        path: { ...((await context.params) ?? {}) },
        query: readQuery(op, new URL(request.url).searchParams),
        ...(op.hasBody && { body: await readJsonBody(request) }),
      };
      const invalid = validateRequest(op, input);
      if (invalid.length > 0) {
        throw new HttpError(400, { detail: "The request does not match the API specification.", errors: invalid });
      }

      let result: ApiResult<K>;
      try {
        result = await handler({ request, principal, ...input } as ApiRequest<K> & { principal: P });
      } catch (error) {
        if (validateResponses && error instanceof HttpError) {
          const errors = validateResponse(operationId, error.problem.status, error.problem);
          if (errors.length > 0) return driftResponse(operationId, error.problem.status, errors);
        }
        throw error;
      }

      const status = Number(result.status);
      if (!Number.isInteger(status)) throw new Error(`${operationId}: respond() needs a concrete status code`);
      if (validateResponses) {
        const errors = validateResponse(operationId, status, result.body);
        if (errors.length > 0) return driftResponse(operationId, status, errors);
      }

      if (result.body === undefined) return new Response(null, { status, headers: result.headers });
      const headers = new Headers(result.headers);
      if (status >= 400) headers.set("content-type", "application/problem+json");
      return Response.json(result.body, { status, headers });
    } catch (error) {
      if (error instanceof HttpError) return problemResponse(error.problem, error.headers);
      console.error(`[api] ${operationId} failed`, error);
      return problemResponse(new HttpError(500).problem);
    }
  };
}

async function readJsonBody(request: Request): Promise<unknown> {
  const tooLarge = new HttpError(400, { detail: `The request body is larger than ${MAX_BODY_BYTES / 1024} KB.` });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw tooLarge;
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw tooLarge;
  if (text.trim() === "") return undefined;
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/([\w.+-]+\+)?json\b/i.test(type)) {
    throw new HttpError(400, { detail: 'Send the request body as "application/json".' });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, { detail: "The request body is not valid JSON." });
  }
}
