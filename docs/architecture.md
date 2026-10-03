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
  logs every run; on failure keeps the previous data and marks the source `outage`; the API reports stale data. The web app never
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

Full register with endpoints, licences and failure behaviour: [`data-sources.md`](data-sources.md).
Deployment, licences and extension: [`deployment.md`](deployment.md).

| Source | What | Licence | Update | Verified by | If unavailable |
|---|---|---|---|---|---|
| OpenStreetMap (Overpass) | places, `wheelchair=*` tags | ODbL 1.0, "© OpenStreetMap contributors" | cron; per object (`check_date`) | provenance ref, reliability from `check_date`, conflicts shown | last facts kept, marked stale |
| MSIP toilets (`WT_WC_2023`) | city toilets, access fields | **to confirm** | dataset 2023, no schedule | matched to OSM by distance | last facts kept, marked stale |
| ZDMK disabled parking (AGOL) | marked parking spaces | **to confirm** | no schedule | own place per space | last facts kept, marked stale |
| ZTP stops inventory (AGOL) | benches, platform surface | **to confirm** | per record (`EditDate`) | own place per platform | last facts kept, marked stale |
| MSIP hotels KOH | hotel names, categories | **to confirm** | import 2023-06-30 | no accessibility claim | last facts kept, marked stale |
| openrouteservice | routing, on demand, server-side | terms to confirm | live | labelled as computed suggestion | routing error, place data still shown |
| OpenFreeMap | base map tiles | MIT; data ODbL | live | n/a | list and text views still work |

A source without a confirmed licence is not ingested. Every fact carries source, fetch time and
reliability; a failed run keeps the previous data and marks it stale.

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
- 2026-10-03 — The venue widget is a plain page at `/widget/{placeId}` embedded with an `<iframe>` (no script SDK); the app header hides itself there and no `X-Frame-Options`/`frame-ancestors` is set — any venue site can embed it without an account, and the card reuses the app's accessible components.
- 2026-10-03 — Ingest writes through a `IngestStore` interface (Drizzle implementation in `apps/ingest/src/store.ts`), facts of one OSM element are keyed by the record ref without its `@version`, a failed fetch writes only the run row and marks the source stale/outage — adapters and the runner are testable without a database, and an OSM edit refreshes a fact instead of duplicating it.
- 2026-10-03 — Bottom safe area (KBB-42): in-flow content relies on the body's `env(safe-area-inset-bottom)` padding, except the full-bleed map screen, which cancels it with a negative bottom margin so the map and `BottomPanel` reach the screen edge with no background seam (the panel pads its content instead); fixed overlays pad themselves — `VaulDrawerContent` in its card, the Toaster via its bottom offset; e2e emulates the iPhone inset through CDP `Emulation.setSafeAreaInsetsOverride`.
- 2026-10-03 — The needs profile lives on the home screen (KBB-41, `/profil` removed): profile parameters ride on the same `GET /places` query as search, category and feature filters; status counters count every result and filter client-side (pressed counter / „Ukryj niespełniające”), and the feature filters stay visible with a profile on, unlike prototype B — the AC keeps filters while the verdicts change.
- 2026-10-03 — Reports API (KBB-19): an accepted report becomes a new fact from the source „Społeczność, zweryfikowane przez moderatora” (`community-moderated`, kind `user_report`, reliability `confirmed`, `confirmedAt` = decision time), superseding only that source's earlier fact for the place and attribute — other sources' facts stay, so a disagreement shows as a conflict instead of a silent overwrite. Confirmations set the fact's `confirmedAt` and `evidence.confirmations`, and the resolver's threshold of 2 does the rest; ingest keeps that count when it refreshes an unchanged fact. Per-client limits key on the address the hosting proxy saw (`x-vercel-forwarded-for`, else the last `x-forwarded-for` hop), never the client-supplied leading hops. Moderators sign in with a bearer token from `MODERATOR_TOKENS` (`name:token`, names go into the history); 5 failed attempts lock a client out for 15 minutes. Abuse protection without puzzles (WCAG 3.3.8): in-memory per-client limits, one confirmation per fact per client a day, and a `website` honeypot; contact data in comments is redacted before saving. The service runs on a `ReportsStore` interface so endpoint tests use an in-memory store; the Drizzle store has its own test that runs when `TEST_DATABASE_URL` is set.
- 2026-10-03 — One verdict implementation: `server/domain` `matchProfile(place, thresholds)` carries the UI's rules (ported from the former `mock-verdict.ts`) plus OSM `wheelchair=no` as an entrance barrier for step-free profiles; profile presets live in `server/domain/profiles.ts` and the browser profile and the mock import them — the API, the mock and the profile screen can't disagree.
- 2026-10-03 — `GET /places` filters text/category/bbox in PostGIS, then resolves every candidate's facts in JS before feature filters, sorting and keyset paging (cursor = last `name, id`) — feature filters depend on the Resolver (conflicts, staleness), which lives in TypeScript; fine for the demo area (hundreds of places), revisit with a materialized resolved-attribute table if a city-wide dataset makes it slow.
- 2026-10-03 — A feature filter passes only on known, fresh data (one known alternative is enough, e.g. a ramp for `step_free`); stale or conflicting data passes only with `includeUnknown`, and a feature known to be missing never does — unknown ≠ accessible, and "show places without data" must not show known barriers.
- 2026-10-03 — `PlaceSummary.features` carries the API's per-filter state (`met`/`absent`/`unknown`/`conflict`) and the list's "Brak danych" badge reads it instead of guessing from chips — chips carry no value, so "2 stopnie" next to an unknown ramp looked like a step-free match.
- 2026-10-03 — The entrance need takes a known ramp or level entrance when the step count is unknown (same alternatives as the `step_free` filter), and a known missing lift is "Nie wiadomo", not a barrier, until we know a place's floors (KBB-47) — OSM rarely counts steps, and a single-storey place must never get a false barrier.
- 2026-10-03 — Ingest writes through a `IngestStore` interface (Drizzle implementation in `apps/ingest/src/store.ts`), facts of one OSM element are keyed by the record ref without its `@version`, a failed fetch writes only the run row and marks the source `outage` — adapters and the runner are testable without a database, and an OSM edit refreshes a fact instead of duplicating it.
- 2026-10-03 — A failed fetch (after bounded retries) always marks the source `outage` with its last success kept; `stale` is derived in `GET /sources` when an `ok` source missed two refresh intervals. The demo switch `SIMULATE_SOURCE_OUTAGE=<id,…>` is server env only (no request input): ingest skips the fetch and fails the run, and the API overlays `outage` on the source — the same outage can be shown without waiting for a real one.
- 2026-10-03 — Place categories are configuration, not a contract enum (KBB-32): one file (`packages/contracts/src/categories.ts`: id, Polish labels, icon key, OSM tags) feeds the Overpass query, the OSM mapper and `GET /categories`; `Place.category` is a free string id, and a city is one file in `apps/ingest/src/cities/` discovered at start-up — adding "Apteki" or a city needs no change in `apps/web`; the trade-off is that the category list lives next to the spec instead of inside it.
- 2026-10-03 — Moderator panel (KBB-25): the moderator pastes the `MODERATOR_TOKENS` token into a password field (password managers and paste work, no puzzle — WCAG 3.3.8); the panel checks it with a 1-item queue request and keeps it in `sessionStorage` only (this tab, gone when it closes), sending it as a bearer header on each call. The queue lists every report (decided ones too) so one request also gives the full history. In mock mode a stateful `withModerationMocks` layer lets decisions change the example queue, accepting any token, and the page says so.
- 2026-10-03 — Public read API: CORS `*` and the data-licence headers (`Link rel=license` ODbL, `X-Data-Attribution`) are set in `next.config.ts` for `/api/v1/**` except moderation and reports; `/api/docs` is a static page loading a pinned Scalar build with SRI from jsDelivr and the spec from `/api/openapi.json` — no new dependency and no per-request work, at the cost of a CDN for the docs page.
- 2026-10-03 — `SourceMeta.licenseConfirmed` gates ingestion: the runner throws before fetching an unconfirmed source and the scheduled all-sources run skips it with a warning, so the city adapters (MSIP toilets, ZDMK parking, ZTP stops) ship tested but load nothing until their licence is confirmed — R3 and the "no licence, no load" rule enforced in code, not by convention.
- 2026-10-03 — Profile needs are data (KBB-48): `OPTIONAL_NEEDS` in `server/domain/profiles.ts` is one ordered list of `flag → need → attribute → rule` (`facility` | `lift` | `surface`) that the matcher, `thresholdsFor`, the localStorage parser, the mock and the thresholds drawer all iterate; a facility need such as `bench` (US-2.8) is one row plus its `Need` value and `require…` parameter in the spec, and a profile like "senior" needs no matcher change — only its preset in `PROFILE_PRESETS` (the profile switch derives `PROFILES` from it), its `Profile` value in the spec and its two Polish labels in `i18n/pl/profile.ts`, each enforced by the compiler. Every need keeps its own `require…` query parameter rather than one generic "required facilities" list, so URLs and the spec stay explicit.
- 2026-10-03 — Deployment: web on Vercel (Root Directory `apps/web`, Frankfurt), Postgres + PostGIS on Neon; the web app talks to the pooled URL, so the DB client sets `prepare: false` and a small pool per serverless instance; migrations, seed and ingest run from GitHub Actions on the direct URL (pooled transaction mode is not suitable for them) and the client drops Neon's `channel_binding` parameter; `NEXT_PUBLIC_API_MOCK=false` is a build-time switch — a managed free tier keeps the demo at zero cost and the runbook is in `docs/deployment.md`.
