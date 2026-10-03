# @krakow-bez-barier/contracts

Spec-first API contract (OpenAPI 3.1). `openapi.yaml` is the single source of truth; web handlers and clients depend on it.

- `npm run contracts:generate` – generates `src/generated/schema.d.ts` (gitignored, never edit). Runs automatically on `postinstall`.
- `npm run lint` – lints the spec with Redocly.
- Import types and the typed `openapi-fetch` client from `@krakow-bez-barier/contracts` (`createApiClient()`).

Rules: see `.claude/rules/contracts.md`. Change the spec first, then regenerate, then implement.
Every operation has an `operationId`, a summary, documented errors (`Problem`, RFC 9457) and examples; the place examples cover
conflicting sources, no data, outdated data and an unavailable source.
