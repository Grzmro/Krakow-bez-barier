import type { operations } from "@krakow-bez-barier/contracts";
import { openapiDocument } from "@krakow-bez-barier/contracts/openapi";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";

export type OperationId = keyof operations;

/** One invalid field, in the shape of `Problem.errors[]`. */
export type FieldError = { field: string; message: string };

type Json = Record<string, unknown>;
type Parameter = { name: string; in: string; required?: boolean; schema?: Json };

type Located<T> = { node: T; pointer: string };

export type CompiledOperation = {
  operationId: OperationId;
  method: string;
  path: string;
  queryParams: { name: string; isArray: boolean }[];
  hasBody: boolean;
  bodyRequired: boolean;
  statuses: string[];
  validateParams: ValidateFunction;
  validateBody: ValidateFunction | undefined;
  responseValidators: Map<string, ValidateFunction>;
};

const SPEC_ID = "openapi";
const METHODS = ["get", "post", "put", "patch", "delete"];
const JSON_MEDIA = "application/json";

// OpenAPI 3.1 Schema Objects are JSON Schema 2020-12, so the whole document is registered once and every
// validator is a `$ref` into it; nested `#/components/...` refs then resolve against the document.
// strict: false because the document root carries OpenAPI keywords (paths, components) Ajv doesn't know.
// Only path/query values arrive as strings and get coerced; a JSON body must match its types exactly.
function createAjv(mode: "params" | "body" | "response"): Ajv2020 {
  const ajv = new Ajv2020({
    strict: false,
    allErrors: true,
    ...(mode === "params" && { coerceTypes: "array", useDefaults: true }),
    ...(mode === "body" && { useDefaults: true }),
  });
  addFormats(ajv);
  ajv.addSchema(openapiDocument, SPEC_ID);
  return ajv;
}

const paramsAjv = createAjv("params");
const bodyAjv = createAjv("body");
const responseAjv = createAjv("response");

const escapePointer = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1");

function at(pointer: string): unknown {
  return pointer
    .split("/")
    .slice(1)
    .reduce<unknown>(
      (node, key) => (node as Json | undefined)?.[key.replace(/~1/g, "/").replace(/~0/g, "~")],
      openapiDocument,
    );
}

/** Follows local `$ref`s, returning the target and its JSON pointer (needed to `$ref` it from a validator). */
function locate<T>(pointer: string): Located<T> {
  let node = at(pointer) as Json | undefined;
  while (node && typeof node.$ref === "string") {
    pointer = node.$ref.replace(/^#/, "");
    node = at(pointer) as Json | undefined;
  }
  if (node === undefined) throw new Error(`OpenAPI: nothing at #${pointer}`);
  return { node: node as T, pointer };
}

const ref = (pointer: string) => ({ $ref: `${SPEC_ID}#${pointer}` });

function findOperation(operationId: string): { method: string; path: string; pointer: string } {
  const paths = (openapiDocument.paths ?? {}) as Record<string, Json>;
  for (const [path, item] of Object.entries(paths)) {
    for (const method of METHODS) {
      if ((item[method] as Json | undefined)?.operationId === operationId) {
        return { method: method.toUpperCase(), path, pointer: `/paths/${escapePointer(path)}/${method}` };
      }
    }
  }
  throw new Error(`OpenAPI: unknown operationId "${operationId}"`);
}

function compileOperation(operationId: OperationId): CompiledOperation {
  const { method, path, pointer } = findOperation(operationId);
  const pathPointer = `/paths/${escapePointer(path)}`;
  const operation = at(pointer) as Json;

  const params = [
    ...(((at(pathPointer) as Json).parameters as unknown[] | undefined) ?? []).map((_, i) =>
      locate<Parameter>(`${pathPointer}/parameters/${i}`),
    ),
    ...((operation.parameters as unknown[] | undefined) ?? []).map((_, i) =>
      locate<Parameter>(`${pointer}/parameters/${i}`),
    ),
  ];

  const group = (location: "path" | "query") => {
    const own = params.filter((p) => p.node.in === location);
    return {
      type: "object",
      properties: Object.fromEntries(
        own.map(({ node, pointer: p }) => {
          // `default` must sit next to the $ref for Ajv's useDefaults to apply it.
          const fallback = node.schema?.default;
          return [node.name, { ...ref(`${p}/schema`), ...(fallback !== undefined && { default: fallback }) }];
        }),
      ),
      required: own.filter((p) => p.node.required || location === "path").map((p) => p.node.name),
    };
  };

  const body = operation.requestBody
    ? locate<{ required?: boolean; content?: Record<string, unknown> }>(`${pointer}/requestBody`)
    : undefined;
  if (body && !body.node.content?.[JSON_MEDIA]) {
    throw new Error(`OpenAPI: ${operationId} has a non-JSON request body; extend server/http/openapi.ts first`);
  }
  const bodyRequired = Boolean(body?.node.required);

  const paramsSchema = {
    type: "object",
    properties: { path: group("path"), query: group("query") },
    required: ["path", "query"],
  };

  const responseValidators = new Map<string, ValidateFunction>();
  const responses = (operation.responses ?? {}) as Record<string, unknown>;
  for (const status of Object.keys(responses)) {
    const response = locate<{ content?: Record<string, unknown> }>(`${pointer}/responses/${escapePointer(status)}`);
    const [media] = Object.keys(response.node.content ?? {});
    if (media) {
      responseValidators.set(
        status,
        responseAjv.compile(ref(`${response.pointer}/content/${escapePointer(media)}/schema`)),
      );
    }
  }

  return {
    operationId,
    method,
    path,
    queryParams: params
      .filter((p) => p.node.in === "query")
      .map(({ node }) => ({
        name: node.name,
        isArray: isArraySchema(node.schema),
      })),
    hasBody: Boolean(body),
    bodyRequired,
    statuses: Object.keys(responses),
    validateParams: paramsAjv.compile(paramsSchema),
    validateBody: body && bodyAjv.compile(ref(`${body.pointer}/content/${escapePointer(JSON_MEDIA)}/schema`)),
    responseValidators,
  };
}

function isArraySchema(schema: Json | undefined): boolean {
  if (!schema) return false;
  if (typeof schema.$ref === "string") return isArraySchema(locate<Json>(schema.$ref.replace(/^#/, "")).node);
  return schema.type === "array";
}

const compiled = new Map<OperationId, CompiledOperation>();

/** Compiled validators for one operation; compiled on first use and cached for the process. */
export function getOperation(operationId: OperationId): CompiledOperation {
  let op = compiled.get(operationId);
  if (!op) {
    op = compileOperation(operationId);
    compiled.set(operationId, op);
  }
  return op;
}

export function toFieldErrors(errors: ErrorObject[] | null | undefined, prefix?: string): FieldError[] {
  return (errors ?? []).map((error) => {
    const segments = error.instancePath.split("/").slice(1).map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
    if (error.keyword === "required") segments.push(String(error.params.missingProperty));
    if (error.keyword === "additionalProperties") segments.push(String(error.params.additionalProperty));
    const field = [prefix, ...segments].filter(Boolean).join(".");
    return { field: field || "(root)", message: error.message ?? "is invalid" };
  });
}

export type RequestInput = { path: Record<string, unknown>; query: Record<string, unknown>; body?: unknown };

/** Validates (and coerces/defaults in place) a request's parameters and body; `[]` means valid. */
export function validateRequest(op: CompiledOperation, input: RequestInput): FieldError[] {
  const errors = op.validateParams(input) ? [] : toFieldErrors(op.validateParams.errors);
  if (op.validateBody) {
    if (input.body === undefined) {
      if (op.bodyRequired) errors.push({ field: "body", message: "is required" });
    } else if (!op.validateBody(input.body)) {
      errors.push(...toFieldErrors(op.validateBody.errors, "body"));
    }
  }
  return errors;
}

/** Reads query parameters into the shapes the spec declares (arrays from repeated or comma-separated values). */
export function readQuery(op: CompiledOperation, searchParams: URLSearchParams): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  for (const { name, isArray } of op.queryParams) {
    const values = searchParams.getAll(name);
    if (values.length === 0) continue;
    // Arrays accept both serializations (repeated keys from openapi-fetch, commas per `explode: false`).
    // A repeated scalar stays an array so validation rejects it instead of silently taking the first.
    if (isArray) query[name] = values.flatMap((v) => v.split(","));
    else query[name] = values.length === 1 ? values[0] : values;
  }
  return query;
}

/** Validates a handler's result against the documented response for that status. */
export function validateResponse(operationId: OperationId, status: number, body: unknown): FieldError[] {
  const op = getOperation(operationId);
  const key = [String(status), `${String(status)[0]}XX`, "default"].find((k) => op.statuses.includes(k));
  if (!key) return [{ field: "status", message: `${status} is not documented for ${operationId}` }];
  const validate = op.responseValidators.get(key);
  if (!validate) return body === undefined ? [] : [{ field: "(root)", message: "the spec documents no body" }];
  return validate(body) ? [] : toFieldErrors(validate.errors);
}
