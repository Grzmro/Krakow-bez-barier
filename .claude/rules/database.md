---
paths:
  - "packages/db/**"
  - "**/drizzle.config.*"
---

# Database — Postgres + PostGIS, Drizzle

- Schema, migrations and the client live only in `packages/db`; web and ingest import it.
- Schema is defined in TypeScript with Drizzle; change the schema, then generate a migration
  (`drizzle-kit generate`). Never edit an applied migration and never hand-write SQL that drifts from
  the schema.
- Geometry columns are PostGIS `geometry(…, 4326)` with a GiST index; spatial filtering (bbox,
  distance, along-route) happens in SQL, not in JS.
- Facts are never overwritten or deleted: a changed value marks the active row `superseded` and
  inserts a new one; unique index on `(sourceId, sourceRecordRef, subject, attribute)` where
  `status = 'active'`.
- DB rows are not API shapes — map them to the contract types in the API layer.
- Connection string from `DATABASE_URL` (`.env`, documented in `.env.example`).
- User reports store no personal data: no e-mail, no IP, photos stripped of EXIF (R7).
