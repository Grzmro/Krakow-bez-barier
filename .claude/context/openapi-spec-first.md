# Why OpenAPI spec-first (and not zod / tRPC)

Contracts between apps live in `packages/contracts/openapi.yaml`; types and the client are generated
from it. Rules: `.claude/rules/contracts.md`.

- **The API is part of the product.** The business model sells accessibility data to hotels, event
  organizers, booking and tourist apps (challenge: business model, R8). A published, documented
  OpenAPI spec is what those customers integrate against, and what the jury can open at `/api/docs`.
- **Language-neutral.** Ingestion or a future mobile app can be written in anything and still
  generate types from the same spec; zod and tRPC lock contracts into TypeScript.
- **Works well with many agents in parallel.** OpenAPI is the most widespread contract format; one
  YAML file is easy to read and diff, and after `contracts:generate` the compiler points every agent
  at what broke.
- **Provenance enforced in one place.** `AccessibilityFact` is a schema every endpoint must return, so
  R2 can't be skipped by a single endpoint.

Trade-off: an extra generate step and runtime validation via a spec-based validator instead of
inline schemas. Accepted.
