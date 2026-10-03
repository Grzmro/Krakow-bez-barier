# Kraków bez barier (HackYeah 2026) — agent context

Hackathon project (HackYeah 2026). Monorepo. A working demo matters more than perfection —
but `main` must always run.

## The challenge — read first

We're building **Kraków bez barier** (partner task by Miasto Kraków): a tool that lets residents and
tourists check the accessibility of places and routes against their individual needs — concrete
barriers and facilities, each with its source, date and reliability. Deadline: **Sunday
4 October 2026, 11:00**. The submission (description, PDF, 3-minute video) and the jury pitch are
**in Polish**.

**[`docs/challenge.md`](docs/challenge.md) holds the most important requirements and is the source
of truth for scope.** Read it before planning any task. Every feature must map to one of its
requirements (R1–R8) or deliverables, and to a user story (US-x.y) in
[`docs/requirements.md`](docs/requirements.md) — our epics and acceptance criteria; anything that doesn't is out of scope unless the team decides
otherwise. The jury watches a live demo for one user group, checks where every piece of data comes
from, and looks hard at the business model — optimize for that.

Respond in the language of the prompt. Code, comments, commits, PRs and docs are in English.
User-facing UI text is in Polish (the jury and the city are Polish); keep it in one place (`apps/web/src/i18n/pl/<area>.ts`, indexed by `pl.ts`) with its English twin in `i18n/en/<area>.ts`.

## How instructions are organized

This file holds only what's needed in every session. Keep it short.

- `.claude/rules/*.md` — area conventions. Claude Code auto-loads one only when it
  Reads/Edits/Writes a file matching its `paths:` — too late for planning, so read them explicitly
  (table below). Other agents never auto-load them.
- `.claude/context/*.md` — feature background (the "why"). Add one when you make a non-obvious
  design choice, and add it to the table below.
- `docs/challenge.md` — challenge requirements, judging and deadlines (source of truth for scope).
- `docs/requirements.md` — our epics and user stories (US-x.y) with acceptance criteria; Linear tasks cite them.
- `docs/architecture.md` — the idea, components, and the decision log.
- `.claude/skills/` — workflows: `task` (Linear task → PR end to end), `review` (self-review
  before PR), `ship` (commit, push, PR), `new-task` (create a Linear task).

### Read before you start

| Task touches | Read |
|---|---|
| API endpoints, `packages/contracts/**`, `apps/web/src/app/api/**`, `apps/web/src/server/**` | `.claude/rules/contracts.md`, `.claude/context/openapi-spec-first.md` |
| UI: `apps/web/src/app/**` pages, `components/`, `i18n/`, `packages/ui/**` | `.claude/rules/web.md`, `design/prototype-b/` |
| DB schema, migrations, SQL: `packages/db/**` | `.claude/rules/database.md` |
| Data sources: `apps/ingest/**` | `.claude/rules/ingest.md` |
| Anything that stores, matches or shows accessibility data (facts, Resolver, Matcher, place/route UI) | `.claude/context/accessibility-facts.md` |

## Stack

TypeScript everywhere, npm workspaces monorepo. Why each piece was chosen: `docs/architecture.md` → Decisions.

- **Contracts:** OpenAPI 3.1, spec-first — `packages/contracts/openapi.yaml` is the single source of
  truth; TS types (`openapi-typescript`) and the client (`openapi-fetch`) are generated from it.
  Geometry is GeoJSON. API docs (Scalar) served from the spec.
- **Web + API:** Next.js 16 (App Router, `src/` layout) in `apps/web`; the API lives in Route
  Handlers under `src/app/api/`, server-only logic in `src/server/`. UI: shadcn/ui (Base UI) +
  Tailwind v4 + `@krakow-bez-barier/ui` (tokens, shared components), Vaul, Sonner, Phosphor icons,
  React Query, MapLibre GL with OpenFreeMap tiles (OSM attribution required).
  **Visual reference: `design/prototype-b/`.**
- **Data:** Postgres + PostGIS; schema, migrations and client with Drizzle ORM in `packages/db`
  (shared by web and ingest).
- **Ingestion:** `apps/ingest` — one adapter per data source, run by a GitHub Actions cron, writes normalized
  facts to the DB. Never called by the web app at request time (R5).
- **Routing:** openrouteservice `wheelchair` profile, server-side only (API key) behind a
  `RoutingProvider` interface.
- **Tests:** Vitest, next to the code as `*.test.ts`. **Deploy:** Vercel (web) + managed Postgres.

## Repo layout

```
apps/web/src/app/       # Next.js pages; api/ = route handlers
apps/web/src/server/    # server-only: Resolver, Matcher, RoutingProvider, DB queries
apps/web/src/i18n/      # all UI strings: pl/<area>.ts + en/<area>.ts per screen area, pl.ts / en.ts = index
apps/mobile/            # Capacitor shell: iOS/Android apps that load the web app (native: lib/native in web)
apps/ingest/            # data source adapters → normalized accessibility facts in the DB
packages/contracts/     # openapi.yaml + generated types/client (src/generated/: gitignored, never edit)
packages/db/            # Drizzle schema, migrations, client
packages/ui/            # "Fiolet" tokens + shared shadcn/ui components
design/                 # UI prototype (reference, not a workspace) and screen concept
docs/                   # challenge, architecture and decisions
```

Don't create a new app or package without a Linear task for it.

## Commands

From the repo root. Target a single workspace with `-w <path>` (e.g. `npm run test -w apps/web`).

```bash
npm install                    # all workspaces
npx playwright install --only-shell chromium   # once, for e2e
npm run dev                    # web app (http://localhost:3000)
npm run dev -w apps/web -- -H 0.0.0.0   # reachable from a phone on the LAN; flags go after `-w apps/web --` (root `npm run dev -- …` drops them)
npm run dev -w apps/web -- -H 0.0.0.0 --experimental-https   # same, for location on the phone: browsers allow geolocation only over https on a LAN IP (accept the self-signed cert on the phone)
npm run lint                   # ESLint
npm run typecheck              # next typegen + tsc
npm run test                   # Vitest (unit)
npm run build                  # production build
npm run test:e2e -- e2e/route.spec.ts   # Playwright: only the specs of the screens you changed; own port per worktree (PORT overrides), 3 workers (E2E_WORKERS overrides)
npm run mobile:ios             # Capacitor: sync + build + run in the iOS Simulator (Xcode; web app must be running)
npm run mobile:android         # Capacitor: sync + debug APK (needs JAVA_HOME = JDK 21, ANDROID_HOME = Android SDK)
npm run build && E2E_PROD=1 npm run test:e2e -- e2e/pwa-offline.prod.spec.ts   # a *.prod.spec.ts (PWA offline, real data) against `next start`
E2E_SPECS="e2e/route.spec.ts" scripts/merge-pr.sh [PR]   # rebase, local gate + those specs, CI, merge (task skill step 8)
npm run icons -w apps/web      # re-render PWA icons after changing the logo mark or brand tokens
npm run routes:record -w apps/web   # re-record the openrouteservice fixtures (ORS_API_KEY in root .env; tests never call ORS)
```

The web app uses the real API (`DATABASE_URL`) by default. `test:e2e` runs the dev-server specs on the
example data (`NEXT_PUBLIC_API_MOCK=true`, no DB needed). It reuses a dev server already running on the
worktree's port — one started without `NEXT_PUBLIC_API_MOCK=true` serves real data and those specs fail, so
stop it first. `places-real-data.prod.spec.ts` needs a seeded DB and skips itself only when `DATABASE_URL`
is unset (root `.env` is loaded). It only reads, but point `DATABASE_URL` at a throwaway DB for e2e anyway.
`place-pending-reports.prod.spec.ts` writes (sends and moderates reports) and runs only with
`E2E_DB_WRITES=1` plus `MODERATOR_TOKENS` — never against the shared DB.

The native apps load the running web app from `CAP_SERVER_URL` (`apps/mobile/.env`, default
`http://localhost:3000` from `.env.example`; phone on LAN: `http://<mac-ip>:3000`; Android emulator:
`http://10.0.2.2:3000`; later the Vercel URL). It's baked in at sync time — rerun the script after a
change. APK: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. More in `apps/mobile/AGENTS.md`.

Planned — add them here when the task lands: `cp .env.example .env` + `docker compose up -d db` +
`npm run db:generate` / `db:migrate` (KBB-10), `npm run contracts:generate` (KBB-8),
`npm run ingest -- --source <id> --city krakow` (KBB-18).

CI (`.github/workflows/ci.yml`) is deliberately tiny — lint, typecheck, unit (~30 s). Build and e2e
run locally: `scripts/merge-pr.sh` runs lint, typecheck, unit, build and the e2e specs of the changed
screens on the rebased commit before merging (`E2E_SPECS` plus the spec files changed vs `origin/main`;
a change to `apps/web`, `packages/ui` or `packages/contracts` with no spec selected is an error;
`--print-specs` shows the selection).

**Keep tests fast** — local gate within a couple of minutes, CI within ~30 s:
- unit tests (Vitest) for logic; no network, no DB unless the test is about the DB;
- e2e = a short smoke per screen (main path + keyboard pass), Chromium only, no `waitForTimeout`,
  no retries — a flaky test gets fixed or deleted, not retried. One scenario per test: a chain of
  scenarios outgrows the 15 s budget on a loaded machine;
- **unit tests always, e2e only for the screens your change touches** — while working and in
  `merge-pr.sh` alike. Never the full suite by default (parallel agents share this machine); run more
  only deliberately, e.g. a `packages/ui` change → the specs of the screens that use the component.
- npm blocks dependency install scripts; a new dependency that needs one goes through
  `npm approve-scripts <pkg>` (recorded in root `package.json` → `allowScripts`).

## Shell commands (agents)

The worktree guard rejects commands it can't verify, and every rejection costs a turn.
- One simple command per Bash call, with absolute paths (`git -C <path> …`) — no `cd … &&`, no
  chains of `git` commands.
- Edit files with Edit/Write, not heredocs or inline Python/sed scripts.
- Run `scripts/merge-pr.sh` in the foreground with `timeout: 600000` (one round fits; killed by the
  timeout → run it again) or in the background plus a Monitor until-loop — never background plus
  `sleep` polling.

## Working with tasks (Linear)

- Team **Krakow Bez Barier**, identifiers `KBB-<n>`. Linear is the source of truth for scope.
- Before starting, read the full task (`get_issue`), including acceptance criteria.
- Statuses: `Backlog` → `Todo` → `In Progress` → `In Review` → `Done` (plus `Canceled`, `Duplicate`).
  Set the task to `In Progress` when you pick it up. The GitHub integration does the rest — a PR whose
  branch or title has `KBB-<n>` moves it to `In Review` when opened and to `Done` when merged; don't
  set those by hand.
- Anything outside the task's scope: don't do it silently — propose a new task.
- Linear comments are short, like a teammate writes them: what's done, what's blocking.

## Git

- **Branch:** `<type>/KBB-<n>` (e.g. `feat/KBB-3`). Add a one-word suffix only when a branch for
  that task already exists (`fix/KBB-3-validation`). The task ID in the name links it to Linear.
- **Commit:** `<type>(KBB-<n>): <imperative summary>` — English, ≤ 72 chars.
  Types: `feat` `fix` `refactor` `perf` `test` `docs` `chore` `build` `ci` `style` `revert`.
  No task? Use a one-word area as scope: `chore(tooling): ...`.
- **Commit body:** required for anything non-trivial — *why* it changed, notable decisions,
  known gaps. Skip it only for typos, formatting, dependency bumps.
- **PR title:** `KBB-<n>: <Sentence case title>` — no `type(scope)` prefix. Body: link to the
  Linear task, what changed, how to test.
- Stage only files relevant to the change (`git add <path>`, never `git add -A` / `git add .`).
- Update a feature branch with `git rebase origin/main`, not by merging `main` into it.
- `docs/architecture.md` merges as `merge=union` (`.gitattributes`): rebases keep both sides' lines
  instead of conflicting — append your Decisions line, don't rewrite others'; if a rebase touched it,
  check it for a doubled or contradictory line.
- **Agents merge their own PRs** once the gates in the `task` skill are green (review fixed, checks
  pass, rebased on `main`) — no waiting for a human. `main` must always build and run.
- Never `--no-verify`, never force-push `main`.

## Product invariants (the jury tests these)

- Every accessibility value carries provenance (source, fetchedAt, reliability) — never a bare value (R2).
- Unknown ≠ accessible: missing data is a neutral "Brak danych", never green; conflicts show both sources.
- Sample data is labeled "PRZYKŁAD" everywhere. A failed source keeps its last data, marked stale.
- Everything on the map is also available as text; keyboard and screen reader work (WCAG 2.2 AA, R6).
- No personal data: the needs profile stays in the browser; reports have no e-mail/IP, photos no EXIF (R4, R7).

## Hard rules

- **Solve the problem, don't hide a workaround.** A hackathon shortcut is fine when it's visible:
  mark it `// TODO(KBB-<n>): ...` with a Linear task. No silent hacks, no fake data presented as real.
- **Never edit generated files** — rerun the generator instead.
- **Never commit secrets.** Config via `.env` (gitignored) + `.env.example` with placeholders.
- **Never hardcode** URLs, ports or credentials — read them from config.
- **One source of truth for contracts** between apps (API types, enums) — in `packages/`, never duplicated.
- **Reuse before you add.** Search for an existing helper/component before writing a new one;
  extend it instead of making a near-copy.
- **Parallel agents share this machine.** Stop only processes you started (keep the PID, `kill <pid>`);
  never `pkill`/`killall` by name (`next-server`, `node`, …) — it kills other agents' servers and tests.
- **Comments are the exception.** Default to none; `//` only for a non-obvious gotcha. No decision
  history or bug stories in comments — that goes in the commit body.

## Definition of done

1. Lint + typecheck + tests pass (run only what you touched). Build yourself only when the `task`
   skill's step 5 says so — `merge-pr.sh` always builds; if the build breaks, fix it before moving on.
2. Tests for business logic and endpoints, structured `// GIVEN` / `// WHEN` / `// THEN`.
   UI gets a Playwright smoke spec (`apps/web/e2e/`) for its main path.
3. Independent review (a separate subagent running the `review` skill), findings fixed.
4. A non-obvious technical decision gets one line in `docs/architecture.md` ("Decisions").
