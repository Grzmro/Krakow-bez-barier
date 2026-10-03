---
paths:
  - "packages/contracts/**"
  - "apps/web/src/app/api/**"
  - "apps/web/src/server/**"
---

# API contracts — OpenAPI spec-first

Background: `.claude/context/openapi-spec-first.md`. Accessibility data model:
`.claude/context/accessibility-facts.md`.

- `packages/contracts/openapi.yaml` (OpenAPI 3.1) is the only place an endpoint, request or response
  shape is defined. Change the spec first, then run `npm run contracts:generate`, then fix what the
  compiler flags.
- `packages/contracts/src/generated/**` is gitignored and regenerated on `npm install`. Never edit it and never hand-write a type that mirrors a schema
  — import it: `import type { components } from "@krakow-bez-barier/contracts"` and alias
  (`type Place = components["schemas"]["Place"]`).
- Client components call the API only through the generated `openapi-fetch` client. Server Components
  call `src/server/*` services directly (the same functions the route handlers use).
- Route handlers validate requests against the spec through one shared helper in
  `apps/web/src/server/http/` (the skeleton task picks the library — don't add a second one) and
  return exactly the spec's shapes; map DB rows
  to API schemas explicitly — DB columns are not the contract.
- Every accessibility value in a response is an `AccessibilityFact` (or a resolved attribute that
  carries its facts) with `source`, `fetchedAt`, `reliability` — never a bare value
  (R2, `.claude/context/accessibility-facts.md`).
- Shared closed vocabularies (accessibility attributes, reliability levels) are enums in the spec, not TS
  constants elsewhere. Place categories are configuration: a free string id in the spec, the list is
  `GET /categories`, defined in `packages/contracts/src/categories.ts`.
- Geometry: GeoJSON (`Point`, `LineString`, `Feature`, `FeatureCollection`), WGS84, `[lon, lat]`.
- Schemas in `components/schemas`, `PascalCase`; properties `camelCase`; enums as lowercase
  `snake_case` strings; dates as ISO 8601 `date-time`. Every operation has an `operationId`,
  a `summary` and documented error responses (`4xx`/`5xx` use the shared `Problem` schema,
  RFC 9457).
- Breaking changes are fine before the demo, but update every caller in the same PR.
