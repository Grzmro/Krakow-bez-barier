// Extracts every response example from openapi.yaml into src/generated/examples.ts, keyed by
// operationId, so clients can mock the API from the same examples the spec documents. JSON examples
// are also emitted as `responseExamples`, each checked against its response schema by `satisfies`.
// Also extracts the report validation rules (ReportCreate `x-value-ranges`, comment maxLength) into
// report-rules.ts.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const spec = yaml.load(readFileSync(join(root, "openapi.yaml"), "utf8"));
const METHODS = ["get", "post", "put", "patch", "delete"];

function resolve(node) {
  if (!node || typeof node !== "object" || typeof node.$ref !== "string") return node;
  const target = node.$ref
    .replace(/^#\//, "")
    .split("/")
    .reduce((acc, key) => acc?.[key.replace(/~1/g, "/").replace(/~0/g, "~")], spec);
  if (target === undefined) throw new Error(`Unresolved $ref ${node.$ref}`);
  return resolve(target);
}

function contentExamples(media) {
  if (media.examples) {
    return Object.fromEntries(Object.entries(media.examples).map(([name, ex]) => [name, resolve(ex).value]));
  }
  return "example" in media ? { default: media.example } : {};
}

const operations = {};
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  for (const method of METHODS) {
    const op = item[method];
    if (!op) continue;
    if (!op.operationId) throw new Error(`${method.toUpperCase()} ${path} has no operationId`);
    const responses = {};
    for (const [status, raw] of Object.entries(op.responses ?? {})) {
      const response = resolve(raw);
      const [contentType, media] = Object.entries(response.content ?? {})[0] ?? [null, {}];
      responses[status] = { contentType, examples: contentExamples(resolve(media)) };
    }
    operations[op.operationId] = { method: method.toUpperCase(), path, responses };
  }
}

const basePath = new URL(spec.servers?.[0]?.url ?? "/", "http://spec.invalid").pathname.replace(/\/$/, "");

const typed = Object.entries(operations)
  .map(([operationId, op]) => {
    const statuses = Object.entries(op.responses)
      .filter(([status, r]) => /^\d+$/.test(status) && r.contentType?.includes("json") && Object.keys(r.examples).length)
      .map(([status, r]) => {
        const json = JSON.stringify(r.examples, null, 2).replace(/\n/g, "\n    ");
        return `    ${status}: ${json} satisfies Record<string, ResponseBody<"${operationId}", ${status}>>,`;
      });
    return statuses.length ? `  ${operationId}: {\n${statuses.join("\n")}\n  },` : null;
  })
  .filter(Boolean)
  .join("\n");

const out = join(root, "src", "generated", "examples.ts");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `// Generated from openapi.yaml by scripts/generate-examples.mjs. Do not edit.
import type { SpecExamples } from "../mock";
import type { operations } from "./schema";

type ResponseBody<O extends keyof operations, S extends keyof operations[O]["responses"]> =
  operations[O]["responses"][S] extends { content: infer C } ? C[keyof C] : never;

export const specExamples: SpecExamples = ${JSON.stringify({ basePath, operations }, null, 2)};

/** JSON response examples by operationId → status → example name, typed by the spec. */
export const responseExamples = {
${typed}
};
`,
);
console.log(`examples: ${Object.keys(operations).length} operations → ${out}`);

const reportCreate = spec.components?.schemas?.ReportCreate ?? {};
const reportRules = {
  commentMaxLength: reportCreate.properties?.comment?.maxLength ?? null,
  valueRanges: reportCreate["x-value-ranges"] ?? {},
};
const rulesOut = join(root, "src", "generated", "report-rules.ts");
writeFileSync(
  rulesOut,
  `// Generated from openapi.yaml (ReportCreate) by scripts/generate-examples.mjs. Do not edit.
import type { ReportRules } from "../report-rules";

export const reportRules: ReportRules = ${JSON.stringify(reportRules, null, 2)};
`,
);
console.log(`report rules: ${Object.keys(reportRules.valueRanges).length} ranges → ${rulesOut}`);
