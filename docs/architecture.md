# Architecture

## Problem and idea

Kraków bez barier (Miasto Kraków) — requirements, judging and deadlines in
[challenge.md](challenge.md).

> TODO: chosen user group, our approach, and what we show in the demo.

## Components

```
 data sources                 apps/ingest (scheduled)            Postgres + PostGIS
 OSM · city open data   ──►   adapter per source  ──► facts ──►  places · facts · sources
 GTFS · reports · …           + provenance, run log              ingestion_runs · reports
                                                                        │
                       apps/web (Next.js)                               ▼
   browser  ◄──►  UI (MUI, MapLibre)  ◄──►  API route handlers ──► Resolver → Matcher
                  needs profile in            │
                  localStorage                └──► RoutingProvider (openrouteservice)
```

- **apps/ingest** — one adapter per source; maps raw records to `AccessibilityFact`s with provenance;
  logs every run; on failure keeps the previous data and marks the source stale. The web app never
  calls data sources at request time (R5).
- **apps/web** — Next.js UI + API route handlers (`src/app/api/`), server logic in `src/server/`. The API resolves facts per attribute (Resolver)
  and matches them against the user's needs (Matcher). Routing is the only on-demand external call,
  behind `RoutingProvider`.
- **packages/contracts** — `openapi.yaml`, the single source of truth for the API; generated types
  and client.
- **packages/db** — Drizzle schema, migrations and client, shared by web and ingest.
- **packages/ui** — MUI theme and providers.

Fact model and principles: `.claude/context/accessibility-facts.md`.

**Adding** a source = a new adapter + source metadata; a place category or attribute = an entry in the
shared vocabulary; a city = a city config (bbox, dataset URLs) — OSM and GTFS work for any city.

## Data sources

> TODO: for each source — origin, terms of use/license, update frequency, how it's verified,
> what happens when it's unavailable (challenge R2, R3).

## Decisions

Format: `YYYY-MM-DD — decision — why`.

- 2026-10-03 — TypeScript monorepo with npm workspaces — one language for UI, API and ingestion; `packages/ui` already used npm.
- 2026-10-03 — Next.js with the API in route handlers — the UI library targets Next.js App Router; one deployable app is fastest for a 24 h build.
- 2026-10-03 — OpenAPI 3.1 spec-first contracts with generated types/client (not zod/tRPC) — the API is a B2B product, language-neutral, easy for parallel agents; see `.claude/context/openapi-spec-first.md`.
- 2026-10-03 — Postgres + PostGIS with Drizzle — spatial queries (bbox, along-route barriers) in SQL; typed schema and generated migrations.
- 2026-10-03 — Ingestion runs on a GitHub Actions cron — free, no extra infrastructure; Vercel only hosts the web app.
- 2026-10-03 — Ingestion as a separate app writing normalized facts with provenance — R2/R5; a source outage degrades to stale data, never to missing data shown as accessible.
- 2026-10-03 — openrouteservice wheelchair profile behind `RoutingProvider` — ready-made incline/kerb/surface parameters; self-hosting a routing engine doesn't fit 24 h; swappable later.
- 2026-10-03 — MapLibre GL + OpenFreeMap tiles — open source, no API key, commercial use allowed with OSM attribution.
