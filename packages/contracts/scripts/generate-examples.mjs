// Extracts every response example from openapi.yaml into src/generated/examples.ts, keyed by
// operationId, so clients can mock the API from the same examples the spec documents.
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
const out = join(root, "src", "generated", "examples.ts");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `// Generated from openapi.yaml by scripts/generate-examples.mjs. Do not edit.
import type { SpecExamples } from "../mock";

export const specExamples: SpecExamples = ${JSON.stringify({ basePath, operations }, null, 2)};
`,
);
console.log(`examples: ${Object.keys(operations).length} operations → ${out}`);
