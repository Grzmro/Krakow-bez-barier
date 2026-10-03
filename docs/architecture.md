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
   browser  ◄──►  UI (shadcn, MapLibre) ◄──►  API route handlers ──► Resolver → Matcher
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
- **packages/ui** — "Fiolet" tokens and shared shadcn/ui components; visual reference in `design/prototype-b/`.

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
- 2026-10-03 — shadcn/ui + Tailwind v4 instead of MUI — built both as clickable prototypes (same 7 screens, then the same 20 requirement changes); the team chose B for its look; generated, owned component code; no CSS-in-JS runtime in Server Components. MUI v9 also needed workarounds on every screen (Stack system props, style-override keys).
- 2026-10-03 — `packages/ui` is consumed as TypeScript source (`transpilePackages`), no build step — a fresh clone runs `npm install && npm run dev` without building packages first.
- 2026-10-03 — Fast test pipeline: Vitest for logic, Playwright Chromium-only smoke (headless shell, no retries) against the production build made earlier in the same CI job; npm, Next and Playwright caches in CI.
- 2026-10-03 — `packages/ui` components take all copy as props; `apps/web/src/components/kbb.tsx` binds the Polish strings — the package stays i18n-free, screens get one-line usage and one source of status words.
- 2026-10-03 — API errors are RFC 9457 `application/problem+json`, lists use cursor pagination, and `FactValue` is a tagged union on `kind` — clients branch on one field, offsets break under live ingest, and problems stay machine-readable.
- 2026-10-03 — CI runs only lint, typecheck and unit tests; build and Playwright e2e run on the developer machine via `scripts/merge-pr.sh` on the rebased commit — keeps CI ~30 s and uses local hardware for the heavy part.
- 2026-10-03 — Native apps are a Capacitor 8 shell (`apps/mobile`, iOS via Swift Package Manager) loading the deployed web app from `CAP_SERVER_URL`, not a static export — the web app needs its route handlers; one codebase for web and stores; native features (geolocation) sit behind `apps/web/src/lib/native/` with a browser fallback.
- 2026-10-03 — Demo area: Stare Miasto + Kazimierz + Stradom (bbox `50.045,19.925 – 50.060,19.960`) — densest OSM coverage (15% of objects have `wheelchair`) and the only area where the MSIP public-toilets layer overlaps OSM, which gives a real conflict case; places and failure cases in [demo-data.md](demo-data.md).
- 2026-10-03 — Until the API routes exist, clients use `createMockFetch()` from `packages/contracts`, which answers from the `examples` in `openapi.yaml` (extracted at generate time) — mocks can't drift from the contract and every screen reuses one layer; `NEXT_PUBLIC_API_MOCK=false` switches to the real API.
- 2026-10-03 — Resolver/Matcher rules: any disagreement between fresh facts is a conflict (never settled by reliability), stale facts count only when no fresh fact exists, stale or conflicting data never yields `met`; profiles are plain config in `server/domain/profiles.ts` — keeps the verdict logic pure and a new profile a config change.
- 2026-10-03 — `GET /places` and `GET /places/{id}` mocks in `apps/web/src/lib/mocks` wrap `createMockFetch()` to add search and profile verdicts, built from the typed `responseExamples` (same generator, checked with `satisfies`) — the profile demo works before the matcher (KBB-17) exists; other endpoints keep the generic mock.
- 2026-10-03 — Profile thresholds travel as flat optional query parameters next to `profile` (not a deepObject) and the profile lives only in localStorage — easy to validate server-side, cacheable URLs, no personal data on the server (R4).
- 2026-10-03 — Profile verdict rules the UI is built on (front-end mock `lib/mocks/mock-verdict.ts`; the places API in KBB-28 must make `server/domain` `matchProfile` agree and take the user's thresholds): a conflict on any attribute of the place rules out `met`, even one the profile doesn't need; steps without a known ramp are `unknown`, not `barrier`; an accepted single step still needs a known threshold within the limit — the UI never shows "Spełnia" on contradictory or missing data (R1, R5).
- 2026-10-03 — PWA with a hand-rolled service worker (`apps/web/public/sw.js`) instead of Serwist — no build plugin to break Turbopack builds, ~150 lines we fully control; it registers only in production and not under automation unless a spec opts in, so `next dev` and other e2e specs never see cached responses. Offline e2e (`*.prod.spec.ts`) runs against `next start` only with `E2E_PROD=1` (set by `merge-pr.sh` after its build) because the dev client doesn't hydrate offline. Each build versions the SW cache (`/sw.js?build=<id>`) and pages carry their own fetch date, shown in the offline banner.
- 2026-10-03 — The `/places` mock also applies `feature` + `includeUnknown` (a feature counts only when a summary chip for it is `known`/`stale`; unknown never passes) and `bbox`, over every `listPlaces` example plus the `getPlace` examples — search and filters on the home screen are demoable before the places API.
- 2026-10-03 — MapLibre's worker is copied to `apps/web/public/vendor/maplibre/` on predev/prebuild and set via `setWorkerUrl` — its ESM build resolves the worker relative to its own URL, which the bundler rewrites.
- 2026-10-03 — The map + list home screen (KBB-23) owns `/`; the KBB-15 profile view moved to `/profil` (menu link) until KBB-41 puts the profile on the home screen — keeps both working on `main` without merging two screens in one PR.
- 2026-10-03 — Report value ranges live in `openapi.yaml` (`ReportCreate.x-value-ranges`) and are generated into `reportRules` — JSON Schema can't bound a number per attribute inside one `FactValue` union; one source keeps form validation and the API's 422 in sync.
- 2026-10-03 — A submitted report is held for 5 s before `POST /reports` so the toast's „Cofnij” really withdraws it — the API has no delete for anonymous reports; pending reports are shown beside the fact and never change its value or verdict before moderation.
- 2026-10-03 — Fact row actions („To się nie zgadza”, „Uzupełnij”, „Potwierdzam”) sit outside the collapsed provenance panel, unlike prototype B — the ≤ 3-tap report AC (US-4.1) wins over the prototype.
- 2026-10-03 — Route handlers validate requests (and, outside production, responses) with Ajv 2020 + ajv-formats against the parsed `openapi.yaml`, behind one `defineRoute(operationId, …)` in `apps/web/src/server/http/` — OAS 3.1 schemas are plain JSON Schema 2020-12, so no OpenAPI-specific validator or router is needed; validators `$ref` into the whole document, so specs never get copied into code.
- 2026-10-03 — `GET /api/v1/health` lives under the versioned base like every other operation and always answers 200 while the app runs, reporting the database as `up`/`down`/`not_configured` in the body — one base path for the client, mock and validator; CI and e2e need no database.
