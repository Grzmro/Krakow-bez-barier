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
requirements (R1–R8) or deliverables; anything that doesn't is out of scope unless the team decides
otherwise. The jury watches a live demo for one user group, checks where every piece of data comes
from, and looks hard at the business model — optimize for that.

Respond in the language of the prompt. Code, comments, commits, PRs and docs are in English.
User-facing UI text is in Polish (the jury and the city are Polish); keep it in one place so English can be added later.

## How instructions are organized

This file holds only what's needed in every session. Keep it short.

- `apps/<name>/AGENTS.md` — stack-specific rules and commands for one app (read it before touching that app).
- `.claude/rules/*.md` — area conventions, path-scoped via `paths:` frontmatter so they load only
  when matching files are opened (e.g. `paths: ["apps/api/**"]`).
- `.claude/context/*.md` — feature background (the "why"). Read the relevant file when a task
  touches that feature; add one when you make a non-obvious design choice.
- `docs/challenge.md` — challenge requirements, judging and deadlines (source of truth for scope).
- `docs/architecture.md` — the idea, components, and the decision log.
- `.claude/skills/` — workflows: `task` (Linear task → PR end to end), `review` (self-review
  before PR), `ship` (commit, push, PR), `new-task` (create a Linear task).

## Stack

> TODO: fill in once the team picks the technologies (languages, frameworks, database, deployment).

## Repo layout

```
apps/       # runnable applications (e.g. apps/api, apps/web), each with its own AGENTS.md
packages/   # shared code (types, API contracts, utils)
docs/       # architecture and decisions
```

Don't create a new app or package without a Linear task for it.

## Commands

> TODO: fill in after choosing the stack (install, dev, build, test, lint — from the repo root).

## Working with tasks (Linear)

- Team **Krakow Bez Barier**, identifiers `KBB-<n>`. Linear is the source of truth for scope.
- Before starting, read the full task (`get_issue`), including acceptance criteria.
- Statuses: `Backlog` → `Todo` → `In Progress` → `In Review` → `Done` (plus `Canceled`, `Duplicate`).
  Set the task to `In Progress` when you pick it up and to `In Review` when its PR is open; a human moves it to `Done` after merge.
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
- Never `--no-verify`, never force-push `main`.

## Hard rules

- **Solve the problem, don't hide a workaround.** A hackathon shortcut is fine when it's visible:
  mark it `// TODO(KBB-<n>): ...` with a Linear task. No silent hacks, no fake data presented as real.
- **Never edit generated files** — rerun the generator instead.
- **Never commit secrets.** Config via `.env` (gitignored) + `.env.example` with placeholders.
- **Never hardcode** URLs, ports or credentials — read them from config.
- **One source of truth for contracts** between apps (API types, enums) — in `packages/`, never duplicated.
- **Reuse before you add.** Search for an existing helper/component before writing a new one;
  extend it instead of making a near-copy.
- **Comments are the exception.** Default to none; `//` only for a non-obvious gotcha. No decision
  history or bug stories in comments — that goes in the commit body.

## Definition of done

1. The affected app builds, and lint + typecheck + tests pass (run only what you touched).
   If the build breaks, fix it before moving on.
2. Tests for business logic and endpoints, structured `// GIVEN` / `// WHEN` / `// THEN`.
   UI may be verified manually when time is short — say so in the PR.
3. Self-review the full diff before declaring done.
4. A non-obvious technical decision gets one line in `docs/architecture.md` ("Decisions").
