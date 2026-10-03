# Deployment and extension guide

Answers the jury's questions on dependencies, licences, portability and scaling to other cities
(challenge R3, R5, R8). Data sources and their terms: `docs/data-sources.md`.


## Components and provider dependencies

| Component | Provided by | Required? | Replace with |
|---|---|---|---|
| Web + API (Next.js 16) | Vercel | No, any Node host | Any Node.js 22+ host or container (`npm run build`, `npm start`) |
| Database | Managed Postgres with PostGIS | PostGIS needed | Any Postgres + PostGIS (`docker compose up -d db` locally); set `DATABASE_URL` |
| Ingestion | GitHub Actions cron | No | Any scheduler running `npm run ingest -- --source <id> --city <city>` |
| Routing | openrouteservice (`ORS_API_KEY`) | No | Another implementation of `RoutingProvider` or self-hosted ORS |
| Transit departures | ZTP Kraków GTFS + GTFS-Realtime (`ZTP_GTFS_BASE_URL`) | No | Any operator's GTFS-Realtime feed (`FeedConfig` list in `src/server/transit/feed.ts`); off in production until the licence is confirmed |
| Base map tiles | OpenFreeMap | No | Any MapLibre-compatible vector tile source, set in config |
| API reference (/api/docs) | Scalar script from jsDelivr (pinned version + SRI) | No | Vendor the script into `public/` and change `src/app/api/docs/route.ts`; the spec is served by the app at `/api/openapi.json` |
| Overpass | Public Overpass instance | No | Another instance or a local extract, set in the city config |
| Accessibility data | OSM, MSIP | See data-sources | Add adapters |

All endpoints, keys and URLs come from environment variables or the city config (`.env.example`),
never from code.

## First deployment (runbook)

Target: the web app and API on Vercel, Postgres with PostGIS on Neon, the ingest cron and
database tasks on GitHub Actions. Steps marked **owner** need repository admin rights.

1. **Database.** Sign up at https://neon.com (GitHub, Google or e-mail, no card for the free tier;
   the service was formerly at neon.tech) and create a Neon project (region AWS Europe, Frankfurt; Postgres 17). From the
   **Connect** dialog (Project Dashboard; the *Connection pooling* toggle switches between the two
   strings, see https://neon.com/docs/connect/connection-pooling) copy two strings: *Pooled connection* (for Vercel) and *Direct connection*
   (for GitHub Actions); the pooled host contains `-pooler`. Keep `?sslmode=require`; a trailing
   `&channel_binding=require` is harmless (the client drops it). PostGIS is created by the first
   migration (`CREATE EXTENSION postgis`), nothing to enable by hand.
2. **GitHub secret (owner).** Repo → Settings → Secrets and variables → Actions → *New repository
   secret*: `DATABASE_URL` = the direct string.
3. **Schema and demo places.** Actions → *Database* → Run workflow → tick *seed*. It runs
   `npm run db:migrate` and `npm run db:seed` (`npm run db:setup` does the same from a laptop with
   `DATABASE_URL` exported). Safe to run again. The seed is not sample data: it holds the 19 demo
   places of `docs/demo-data.md` with real values from OpenStreetMap and the MSIP toilets layer (a
   snapshot of 2026-10-03, labelled as such in the source row) and is what gives the demo its
   changing-table conflict while MSIP cannot be ingested live. Ingest later upserts the same places
   by their `osm:` reference.
4. **Vercel (owner installs the GitHub app, KBB-45).** Import the repo with Root Directory
   `apps/web` (`apps/web/vercel.json` sets the framework and the Frankfurt region). **Name the
   project `kbb-<random token>`** (`echo "kbb-$(openssl rand -hex 12)"`), so the address
   `https://kbb-<token>.vercel.app` can't be guessed or found by browsing; the app also sends
   `noindex` and serves `Disallow: /` in `robots.txt`. This hides the demo, it does not protect
   it: anyone with the link (the submission and the video contain it) can open it. Real access
   control is Vercel's Password Protection (Pro plan); don't add a custom domain if you want to keep
   the address private. Vercel's free
   Hobby plan only deploys repositories of a personal GitHub account: if `Grzmro` is an
   organisation, use Pro or import a fork. Set the environment variables **before the first
   deploy** (or redeploy after changing them) for Production:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the pooled string |
   | `NEXT_PUBLIC_API_MOCK` | leave unset: the real API is the default (`true` = example data; read at **build** time) |
   | `MODERATOR_TOKENS` | `name:token`, token from `openssl rand -hex 24`; empty keeps moderation closed |
   | `MODERATOR_DEMO_TOKEN` | the jury's demo moderator account (16+ characters); its decisions are undone after 30 min. The jury enters it with the one-click button on `/moderator` (a server-signed demo session, the token itself is never shown); empty disables the account and hides the button |
   | `ORS_API_KEY` | only when routes (KBB-22) are used |

   Leave `SIMULATE_SOURCE_OUTAGE` unset. Previews: set `NEXT_PUBLIC_API_MOCK=true`
   and `DATABASE_URL` unset in the Preview environment, or point them at a separate Neon branch,
   so previews never write to the production database.
5. **First ingest (owner).** Actions → *Ingest* → Run workflow, *area* left empty. It migrates, then
   loads OpenStreetMap for the whole city (about 4,600 OSM objects, see *City-wide data* below;
   expect 5–15 minutes, the job allows 30). Whole-city Overpass has never been tried (it was
   unreachable while we measured), so this first run is its first real test: check the run time
   and whether Overpass or the Geofabrik fallback was used in the Actions log. Typing `demo` as *area* loads only the Stare Miasto
   box. The cron then runs daily at 03:17 UTC for the whole city. MSIP/ZDMK/ZTP sources are skipped
   until their licences are confirmed (`docs/data-sources.md`).
6. **Check.** `scripts/smoke-deploy.sh https://<project>.vercel.app` must print "All checks passed"
   (it retries the health check while a sleeping Neon database wakes up). It covers the database,
   seeded data, place card, widget, docs and CORS, but not which data the UI uses: also open the
   site and expect real places (`Czarna kaczka`, ...), not the example set. If you see examples,
   `NEXT_PUBLIC_API_MOCK` was `true` at build time.
7. **Live outage demo.** Set `SIMULATE_SOURCE_OUTAGE=msip-toilets` and `ALLOW_SIMULATED_OUTAGE=true`
   in Vercel, redeploy, show the stale card and *O danych*, then remove both and redeploy.

Cost: Vercel Hobby and Neon Free are enough for the demo; the plan for running costs after the
hackathon is in the submission documents.

## City-wide data

The Kraków config ingests the bounding box of the whole city (`bbox` in
`apps/ingest/src/cities/krakow.ts`, 49.967,19.792 – 50.126,20.217). Smaller named boxes live under
`areas` (today `demo`, Stare Miasto + Kazimierz + Stradom); a run takes one with `--area <name>`,
`INGEST_AREA=<name>` or the *area* input of the Ingest workflow. No code change either way.

Measured on 2026-10-03, local run from the Geofabrik extract of 2026-10-02 (Overpass unreachable,
so the fallback of KBB-70 was used), on top of the 19 seeded demo places:

| Measure | Value |
|---|---|
| OSM objects read in the box | 4,592 |
| places stored | 4,305 (restaurants, cafés and bars 2,491; hotels 425; monuments 396; pharmacies 308; other 276; toilets 270; museums 98; theatres 41) |
| outside the demo box | 3,347 (e.g. east of 20.00° — Nowa Huta: 569; south of 50.04° — Podgórze and further: 734) |
| active facts | 1,440 — `wheelchair_overall` on 815 places (468 yes, 117 limited, 230 no), `levels` 457, `changing_table` 96, `toilet_accessible` 48; the other ~3,500 places show "Brak danych" |
| size in the database | `places` + `facts` 3 MB; the whole database 21 MB (7 MB of it is PostGIS's `spatial_ref_sys`), well inside Neon Free's 0.5 GB |

**Run time.** Reading the 200 MB extract and writing locally takes under a minute. Writing is a few round trips per record,
so the distance to the database decides: the CLI writes 16 records at a time
(`INGEST_CONCURRENCY`). A re-run through a proxy adding 90 ms per round trip (roughly GitHub's
runners to Neon Frankfurt) took 287 s with 16 writers and 560 s with 8, which puts one at a
time above an hour. When Overpass is down it costs up to ~8 minutes of retries before the
extract is used, so the job's `timeout-minutes` is 30.

**`GET /places` latency** on these 4,305 places (`next start`, local Postgres, median of 9):
first page near the Rynek 0.19 s, with a profile 0.13 s, with a feature filter 0.12 s, one
category (restaurants) 0.06 s, "W mojej okolicy" in Nowa Huta 0.014 s, text search 0.018 s. The
list API resolves every candidate's facts before paging (`docs/architecture.md`); at this size it
stays far under the 1 s budget, and Vercel and Neon in the same region add little to it. A page of
100 places is about 54 KB of JSON. Without a position the home list and map hold the 100 places
nearest the Rynek and say so; the rest of the city shows through search, a category, a filter or
"W mojej okolicy" until the map loads places for its viewport (KBB-88).

**`GET /city/stats`** (the `/miasto` panel) loads every place outside the bulk categories with its
active facts and aggregates them in JS. On these 4,305 places, calling `getCityStats` directly
against local Postgres: 0.21 s cold, 0.07–0.09 s warm (6 runs), a 2.7 KB answer. No
precomputation is needed at city scale.

**Refresh.** The daily cron re-reads the whole city; unchanged facts only get a new `fetchedAt`.
To refresh by hand: Actions → *Ingest* → Run workflow, or from a laptop with the production
`DATABASE_URL` exported: `npm run ingest -- --city krakow --source osm`. A failed source keeps
its last data and is shown as stale.

## Licences

**Data** (details and status: `docs/data-sources.md`)

- OSM: ODbL 1.0, attribution "© OpenStreetMap contributors". The facts we derive from OSM form a
  derivative database; if we publish an extract it must stay under ODbL with attribution. Mixing in
  MSIP data in a published extract depends on the MSIP licence.
- MSIP toilets and KOH hotels: licence **to confirm**. The MSIP regulation allows download only of
  data classified OPEN DATA and forbids commercial redistribution; classification of these two
  layers is unverified.
- openrouteservice: terms **to confirm** (attribution and quotas; commercial use may need a paid plan).
- ZTP Kraków GTFS / GTFS-Realtime: licence **to confirm** (none published next to the feeds); a production build
  serves no departures until `ZTP_SOURCE.licenseConfirmed` is set.
- OpenFreeMap: tiles free to use with attribution; project MIT.

**Components.** Open-source dependencies come from `package.json` files (npm). We have not run a
licence audit; **to confirm** with a tool such as `license-checker` before the submission states
a licence for the whole product. The project's own licence has not been chosen yet (**to
confirm** with the team).

## Moving to other infrastructure

1. Provision Postgres with PostGIS and set `DATABASE_URL`.
2. `npm install`, `npm run db:migrate`.
3. Set `ORS_API_KEY` (or switch `RoutingProvider`).
4. `npm run build` and run the web app on any Node host.
5. Schedule `npm run ingest -- --source <id> --city <city>` for each source (cron, systemd timer,
   Kubernetes CronJob, ...).

No code depends on Vercel-only features; the ingest never runs at request time (R5).

## Add a city

A city is configuration only, in `apps/ingest/src/cities/<city>.ts`:

1. Create `apps/ingest/src/cities/<city>.ts` exporting a `CityConfig`: id, name, language, bbox (plus optional named `areas`),
   map defaults, enabled sources, optional category subset and the endpoint per source (OSM
   needs only the bbox). `wroclaw.ts` is a minimal example. Files in that directory are
   discovered at start-up, there is nothing to register.
2. Run `npm run ingest -- --source osm --city <city>`. Add it to `.github/workflows/ingest.yml`
   to schedule it.

OSM works for any city with no code. City-specific open datasets (like MSIP) need an adapter, see
"Add a source". No web or API change is needed.

## Add a place category

Add one entry to `packages/contracts/src/categories.ts`: id, Polish plural and singular label,
icon key and the OSM tags (e.g. `{ key: "amenity", values: ["pharmacy"] }`). That feeds the
Overpass query, the mapper and `GET /categories`, which the web filter and place card read; no
change in `apps/web`. The icon key must be one the web icon registry knows
(`apps/web/src/lib/categories.tsx`), otherwise a generic pin is shown. Re-run the ingest to fill it.

A new accessibility attribute still goes through the enum in `packages/contracts/openapi.yaml`.
Adapters skip and count values they cannot map.

## Add a source

1. Confirm the licence and terms. **No known licence, no ingest.**
2. Add `apps/ingest/src/adapters/<source-id>.ts` implementing `SourceAdapter` (metadata,
   `fetch`, `map`); metadata includes URL, licence, attribution, update frequency, reliability.
3. Register it in `apps/ingest/src/registry.ts` *(not yet in main)* and add dataset URLs to the city
   configs that use it.
4. Add a mapper test with a recorded fixture.
5. Add its entry to `docs/data-sources.md`.

Output is always `AccessibilityFact`s with provenance; the web app and API are untouched.
