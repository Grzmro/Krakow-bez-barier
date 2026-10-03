import type { operations } from "@krakow-bez-barier/contracts";
import { openapiDocument } from "@krakow-bez-barier/contracts/openapi";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";

export type OperationId = keyof operations;

/** One invalid field, in the shape of `Problem.errors[]`. */
export type FieldError = { field: string; message: string };

type Json = Record<string, unknown>;
type Parameter = { name: string; in: string; required?: boolean; style?: string; explode?: boolean; schema?: Json };

type Located<T> = { node: T; pointer: string };

export type CompiledOperation = {
  operationId: OperationId;
  method: string;
  path: string;
  queryParams: { name: string; isArray: boolean; explode: boolean }[];
  hasBody: boolean;
  bodyRequired: boolean;
  statuses: string[];
  validateRequest: ValidateFunction;
  responseValidators: Map<string, ValidateFunction>;
};

const SPEC_ID = "openapi";
const METHODS = ["get", "post", "put", "patch", "delete"];
const JSON_MEDIA = "application/json";

// OpenAPI 3.1 Schema Objects are JSON Schema 2020-12, so the whole document is registered once and every
// validator is a `$ref` into it; nested `#/components/...` refs then resolve against the document.
// strict: false because the document root carries OpenAPI keywords (paths, components) Ajv doesn't know.
function createAjv(request: boolean): Ajv2020 {
  const ajv = new Ajv2020({
    strict: false,
    allErrors: true,
    ...(request && { coerceTypes: "array", useDefaults: true }),
  });
  addFormats(ajv);
  ajv.addSchema(openapiDocument, SPEC_ID);
  return ajv;
}

const requestAjv = createAjv(true);
const responseAjv = createAjv(false);

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

  const requestSchema = {
    type: "object",
    properties: {
      path: group("path"),
      query: group("query"),
      ...(body && { body: ref(`${body.pointer}/content/${escapePointer(JSON_MEDIA)}/schema`) }),
    },
    required: ["path", "query", ...(bodyRequired ? ["body"] : [])],
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
        explode: node.explode ?? (node.style ?? "form") === "form",
      })),
    hasBody: Boolean(body),
    bodyRequired,
    statuses: Object.keys(responses),
    validateRequest: requestAjv.compile(requestSchema),
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

export function toFieldErrors(errors: ErrorObject[] | null | undefined): FieldError[] {
  return (errors ?? []).map((error) => {
    const segments = error.instancePath.split("/").slice(1).map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
    if (error.keyword === "required") segments.push(String(error.params.missingProperty));
    return { field: segments.join(".") || "(root)", message: error.message ?? "is invalid" };
  });
}

/** Reads query parameters into the shapes the spec declares (arrays from repeated or comma-separated values). */
export function readQuery(op: CompiledOperation, searchParams: URLSearchParams): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  for (const { name, isArray, explode } of op.queryParams) {
    const values = searchParams.getAll(name);
    if (values.length === 0) continue;
    // Accept both serializations: openapi-fetch repeats keys by default, the spec may declare explode: false.
    query[name] = isArray ? values.flatMap((v) => (explode ? [v] : v.split(","))) : values[0];
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
