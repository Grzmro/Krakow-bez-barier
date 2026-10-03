---
paths:
  - "apps/web/src/app/**/*.tsx"
  - "apps/web/src/components/**"
  - "apps/web/src/i18n/**"
  - "packages/ui/**"
---

# Web app — Next.js, shadcn/ui, MapLibre, WCAG 2.2 AA

**Visual reference: `design/prototype-b/`** (run it, port from it — see its README). Match its look,
copy and interactions; requirements in `docs/requirements.md` win where they differ.

- App Router. Server Components by default; `"use client"` only for interactivity (map, forms,
  React Query hooks).
- UI: shadcn/ui (style `base-nova`, built on **Base UI, not Radix**) + Tailwind v4. Shared
  components and the "Fiolet" tokens live in `packages/ui`; add primitives with
  `npx shadcn@latest add <name>`, then fix what the generator gets wrong (below).
- Styling only through tokens (shadcn CSS variables + our status/brand tokens) and Tailwind
  classes — no hard-coded colors (except `maplibre-gl/dist/maplibre-gl.css`; map layer colors come
  from tokens). Any new color pair must meet WCAG contrast (4.5:1 text, 3:1 UI/graphics).
- Icons: Phosphor (`@phosphor-icons/react`). Fonts: Manrope (headings), Inter (body).

## shadcn gotchas (learned in the prototype)

- Generated files import icons from lucide and `sonner.tsx` imports `next-themes` — switch to Phosphor
  and our theme handling.
- Generated files import `cn` from the npm package `"cn"`; use our `@/lib/utils` `cn` everywhere.
- The base-nova `drawer.tsx` is Base UI's Drawer, not Vaul. For modal sheets (report form, threshold
  editor) use the Vaul drawer from the prototype (`components/ui/vaul-drawer.tsx`).
- **Don't use Vaul snap points for the map/list sheet** — inner scroll only works at the last snap
  point and it's modal. Use the non-modal `BottomPanel` (two heights, grabber + button alternative).
- Vaul overlay: black at 40%, not the ink token (ink is near-white in dark mode).
- Button: `rounded-full`, 48 px default / 56 px large; focus = 3 px outline with 2 px offset.
- Status variants live in Badge via `cva`; "Brak danych" has a dashed border.
- **All user-facing text lives in the messages module, in Polish and English** (menu switch, cookie
  `kbb-lang`, default Polish). No string literals in components. One file per area —
  `apps/web/src/i18n/pl/<area>.ts` (`common`, `home`, `place`, `profile`, `pages`, `moderator`, …),
  composed in `pl.ts`, and the same file in `i18n/en/` (typed against Polish: a missing key fails the
  build). Add a string to both. Read copy with `useMessages()` / `useLocale()` (`@/i18n/client`) in
  Client Components and `await getMessages()` (`@/i18n/server`) in Server Components and metadata;
  lib helpers take a `locale`. Shared component copy (status words, reliability) is in `common`.
- Shared components: import them from `@/components/kbb` (copy already bound), primitives
  (`Button`, `Badge`, `VaulDrawer`, `Toaster`/`toast`, `useAnnounce`) from `@krakow-bez-barier/ui`.
  Announce async results with `useAnnounce()` — the layout owns the one `aria-live` region.
  Preview every state at `/dev/components`.
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
- Map attribution (© OpenStreetMap contributors) is never removed: `MapControls` collapses it into an "i" button
  (always visible, expands to the linked sources; text stays in the DOM for screen readers).
- Every screen has an e2e spec using `e2e/fixtures.ts`: aria snapshot of `main`, `expectAccessible()`
  (axe WCAG 2.2 A/AA, zero violations) and an `evidence()` screenshot. axe catches roughly a third of
  issues — still do a keyboard pass; VoiceOver checks are manual, say so in the PR.
- Run only the specs of the screens you changed (`npm run test:e2e -- e2e/<screen>.spec.ts`) and pass the
  same list to `scripts/merge-pr.sh` (`E2E_SPECS`; it adds the spec files you changed). Changed a shared component (`components/`,
  `packages/ui`)? Add the specs of the screens that use it. Never the full suite by default.
- Specs run on a phone (Pixel 7) except `e2e/*-desktop.spec.ts`, which the `desktop` project runs at
  1440×900 (the demo laptop). A screen with a desktop layout gets its desktop checks there; name
  evidence `desktop-<screen>` so the desktop screenshots sit together.
