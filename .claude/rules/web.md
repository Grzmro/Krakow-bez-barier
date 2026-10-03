---
paths:
  - "apps/web/src/app/**/*.tsx"
  - "apps/web/src/components/**"
  - "apps/web/src/i18n/**"
  - "packages/ui/**"
---

# Web app — Next.js, MUI, MapLibre, WCAG 2.2 AA

- App Router. Server Components by default; `"use client"` only for interactivity (map, forms,
  React Query hooks). Wrap the app in `Providers` from `@krakow-bez-barier/ui`.
- Styling through the MUI theme in `packages/ui` — no hard-coded colors or ad-hoc CSS files
  (except `maplibre-gl/dist/maplibre-gl.css`; map layer colors come from theme tokens). Any new
  color pair must meet WCAG contrast (4.5:1 text, 3:1 UI/graphics).
- **All user-facing text is Polish and lives in one messages module** (`apps/web/src/i18n/pl.ts`) so
  English can be added later. No string literals in components.
- Client components: React Query + the generated `openapi-fetch` client. Server Components: call
  `src/server/*` services directly — never the DB or an external data source.

## Accessibility (R6) — part of done, not polish

- Everything shown on the map is also available as text: a list/table view of places and a numbered
  list of route steps and barriers. The map is never the only way to get information.
- Fully keyboard-operable: logical tab order, visible focus, no traps, skip link to main content.
  Map markers are reachable from the list, not only by mouse.
- Semantic HTML first, ARIA only when needed; live regions for async results ("Znaleziono 12 miejsc").
- Target size ≥ 24×24 px (2.5.8); no drag-only interactions (2.5.7); focus not obscured by sticky
  headers or drawers (2.4.11).
- Never convey status by color or icon alone — always a text label ("Brak danych", "Niepotwierdzone").
- **Unknown ≠ accessible.** Missing data is styled neutral, never green; conflicts show both values with
  their sources. Read `.claude/context/accessibility-facts.md` before building place or route views.
- Sample/demo data is labeled "PRZYKŁAD" wherever it appears.
- Map attribution (© OpenStreetMap contributors) always visible.
- UI may be verified manually (keyboard + VoiceOver) — say so in the PR.
