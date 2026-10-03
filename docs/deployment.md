# Deployment and extension guide

Answers the jury's questions on dependencies, licences, portability and scaling to other cities
(challenge R3, R5, R8). Data sources and their terms: `docs/data-sources.md`.


## Components and provider dependencies

| Component | Provided by | Required? | Replace with |
|---|---|---|---|
| Web + API (Next.js 16) | Vercel | No, any Node host | Any Node.js 20+ host or container (`npm run build`, `npm start`) |
| Database | Managed Postgres with PostGIS | PostGIS needed | Any Postgres + PostGIS (`docker compose up -d db` locally); set `DATABASE_URL` |
| Ingestion | GitHub Actions cron | No | Any scheduler running `npm run ingest -- --source <id> --city <city>` |
| Routing | openrouteservice (`ORS_API_KEY`) | No | Another implementation of `RoutingProvider` or self-hosted ORS |
| Base map tiles | OpenFreeMap | No | Any MapLibre-compatible vector tile source, set in config |
| API reference (/api/docs) | Scalar script from jsDelivr (pinned version + SRI) | No | Vendor the script into `public/` and change `src/app/api/docs/route.ts`; the spec is served by the app at `/api/openapi.json` |
| Overpass | Public Overpass instance | No | Another instance or a local extract, set in the city config |
| Accessibility data | OSM, MSIP | See data-sources | Add adapters |

All endpoints, keys and URLs come from environment variables or the city config (`.env.example`),
never from code.

## Licences

**Data** (details and status: `docs/data-sources.md`)

- OSM: ODbL 1.0, attribution "© OpenStreetMap contributors". The facts we derive from OSM form a
  derivative database; if we publish an extract it must stay under ODbL with attribution. Mixing in
  MSIP data in a published extract depends on the MSIP licence.
- MSIP toilets and KOH hotels: licence **to confirm**. The MSIP regulation allows download only of
  data classified OPEN DATA and forbids commercial redistribution; classification of these two
  layers is unverified.
- openrouteservice: terms **to confirm** (attribution and quotas; commercial use may need a paid plan).
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

1. Create `apps/ingest/src/cities/<city>.ts` exporting a `CityConfig`: id, name, language, bbox,
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
