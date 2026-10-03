# @krakow-bez-barier/contracts

Spec-first API contract (OpenAPI 3.1). `openapi.yaml` is the single source of truth; web handlers and clients depend on it.

- `npm run contracts:generate` – generates `src/generated/schema.d.ts` and `src/generated/examples.ts` (gitignored, never edit). Runs automatically on `postinstall`.
- `responseExamples` – every JSON response example from the spec, type-checked against its schema with `satisfies`; the web app's profile mocks are built from it.
- `npm run lint` – lints the spec with Redocly.
- Import types and the typed `openapi-fetch` client from `@krakow-bez-barier/contracts` (`createApiClient()`).
- `createMockFetch()` answers requests with the spec's response `examples` (generated to `src/generated/examples.ts`):
  `createApiClient({ fetch: createMockFetch({ choose: { getPlace: { example: "conflicting" } } }) })`. By default it returns
  the first 2xx response and the example whose `id` matches the path parameter (the documented 404 if the examples have ids
  and none matches), else `default`, else the first. In the web
  app use `api` from `apps/web/src/lib/api.ts`, which switches on `NEXT_PUBLIC_API_MOCK`.

Rules: see `.claude/rules/contracts.md`. Change the spec first, then regenerate, then implement.
Every operation has an `operationId`, a summary, documented errors (`Problem`, RFC 9457) and examples; the place examples cover
conflicting sources, no data, outdated data and an unavailable source.
