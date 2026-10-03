---
paths:
  - "apps/ingest/**"
---

# Ingestion — data source adapters

Background: `.claude/context/accessibility-facts.md`. Requirements: R2, R3, R5 in `docs/challenge.md`.

- One adapter per source in `apps/ingest/src/adapters/<source-id>.ts`, implementing the
  `SourceAdapter` interface (`apps/ingest/src/adapter.ts`): source metadata + `fetch` (raw records) + `map` (raw → facts).
  Adding a source must not require changes in the web app or the API.
- Each source registers its metadata: name, URL/endpoint, license and terms, attribution text,
  update frequency, base reliability. A source without a known license is not ingested.
- Output is always `AccessibilityFact`s with provenance: `sourceId`, `sourceRecordRef`
  (e.g. `osm:node/123@v7`), `fetchedAt`, `observedAt` when the source says when it was true,
  `reliability`. Never write a fact without them.
- Map source values to the attribute vocabulary (enum in `packages/contracts/openapi.yaml`); don't invent per-source attributes. An
  unmappable value is skipped and counted in the run log, not guessed.
- Every run writes an `ingestion_run` row (source, status `ok`/`partial`/`failed`, record count,
  error). **A failed fetch keeps the previous facts** and marks the source `outage` (the API shows it as stale while it still serves the last data) — never delete
  data because a source is down.
- Idempotent and re-runnable. Unchanged value → refresh `fetchedAt`. Changed value → mark the active
  row `superseded` and insert a new one (unique on `(sourceId, sourceRecordRef, subject, attribute)`
  where `status = 'active'`).
- Respect providers' terms: Overpass/API rate limits, a descriptive `User-Agent`, cache downloads
  locally during development. Publicly available ≠ free to scrape — check terms before adding a source.
- Writes go through `packages/db`; scheduled by a GitHub Actions cron.
- City-specific settings (bbox, dataset URLs) come from the city config, never hard-coded.
- Tests: a mapper test per adapter with a recorded fixture (`// GIVEN` / `// WHEN` / `// THEN`).
