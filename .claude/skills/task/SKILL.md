---
name: task
description: End-to-end, autonomous delivery of one Linear task (KBB-<n>) — read the task, set In Progress, branch, plan, implement, verify (incl. Playwright smoke), independent review + fixes, PR, merge when green, comment in Linear. Use for "/task KBB-12", "do KBB-12", "zrób taska KBB-12", "weź KBB-12", "ogarnij KBB-12 od początku do końca".
---

# Task — one Linear task → one PR

Invoking this skill authorizes: creating the branch, commits, pushing that branch, opening a PR,
**merging that PR when every gate in step 8 is green**, changing the task status to `In Progress`,
and one short Linear comment. The team works autonomously: don't wait for a human to merge —
mistakes get fixed in follow-up tasks. `main` must still always build and run.
Never: push to `main` directly, merge someone else's PR, force-push `main`, skip a failing gate,
create new Linear tasks without asking.

## 0. Identify the task

- Explicit argument (`KBB-12`) wins; otherwise take it from the branch name (`KBB-\d+`);
  otherwise ask.
- Check where you are first — the flow may be resumed:
  ```bash
  git rev-parse --abbrev-ref HEAD
  git log origin/main..HEAD --oneline
  gh pr list --head "$(git rev-parse --abbrev-ref HEAD)"
  ```
  Skip the phases that are already done.
- **First action once the task is known: set it to `In Progress`** (`save_issue`, `state: "In Progress"`)
  — before reading or planning, so the other person and other agents see it's taken. If it's
  already `In Progress` and assigned to someone else, stop and ask.

## 1. Understand

- `get_issue` and `list_comments` — comments often carry the final decisions.
- Read `docs/challenge.md` (requirements this task serves), `docs/architecture.md`, and the files listed for your area in `AGENTS.md` → *Read before you start*
  (rules and context files).
- If the task is ambiguous or its acceptance criteria contradict the code, ask — don't guess.

## 2. Branch

```bash
git fetch origin
git branch -a | grep -i "KBB-12"          # does a branch already exist?
git switch -c feat/KBB-12 origin/main      # type: feat | fix | refactor | chore | docs | test
```

If the working tree has someone else's uncommitted work, use a worktree instead:
`git worktree add ../Krak-w-bez-barier-KBB-12 -b feat/KBB-12 origin/main`.

## 3. Plan

Plan before writing code — always, except a one-file change. Post it as a **Linear comment** on
the task (use the `linear-comment` skill), so the team sees the approach before the diff:
- files/areas to touch and the contract changes in `packages/`;
- each acceptance criterion → the step that delivers it;
- tests to add (unit, e2e spec + aria snapshot + axe for UI);
- risks and anything you'll leave out.

Keep it to ~10 lines. If the plan reveals the task is unclear or blocked, stop and ask instead of
coding. Out-of-scope findings go to a list for the final report (propose tasks via `new-task`), not
into the diff.

## 4. Implement

Follow `AGENTS.md` hard rules. Small, coherent commits as you go (see `ship` for the format).

## 5. Verify

- Lint, typecheck and unit tests of every affected app pass (commands in root `AGENTS.md` → Commands).
- `npm run build` only when the change touches `next.config.*`, the service worker / PWA
  (`public/sw.js`, manifest, icons) or route handlers (`src/app/api/**`), or you run a
  `*.prod.spec.ts` — `merge-pr.sh` always builds, so a build "just in case" only costs time.
- New business logic and endpoints have tests (`// GIVEN` / `// WHEN` / `// THEN`).
- **E2E: only the specs of the screens you changed** — `npm run test:e2e -- e2e/<screen>.spec.ts`
  (add `E2E_PROD=1` after `npm run build` for a `*.prod.spec.ts`). Never the full suite by default:
  parallel agents share this machine. Changed a shared component (`packages/ui`, `components/`)?
  Run the specs of the screens that use it. Note the specs you ran — step 8 passes them to the merge.
- **UI changed → Playwright smoke**: add or extend a spec in `apps/web/e2e/`
  that imports `test`/`expect` from `./fixtures` and, for your screen:
  - clicks the main path (open, key interaction, keyboard-only pass);
  - `toMatchAriaSnapshot({ name: "<screen>.aria.yml" })` on `main` — the structure check
    (create/update with `npx playwright test --update-snapshots`, review the YAML diff);
  - `await expectAccessible()` — axe WCAG 2.2 A/AA must report zero violations (fix them, don't
    exclude, unless it's a known third-party issue noted in the PR);
  - `await evidence("<screen>")` — screenshot to `test-results/evidence/`.
  Look at the evidence screenshot and compare it with the matching screen in `design/prototype-b/`;
  fix obvious visual gaps. To explore a screen freely before writing the spec, use the
  `playwright-cli` skill (headless, cheaper in tokens than an MCP browser).
- **API changed** → hit the endpoint (curl or a test) and check the response against `openapi.yaml`.
- Tick every acceptance criterion — or state explicitly which one isn't met and why.

## 6. Independent review

Fresh eyes catch what the author misses. Running inside a workflow with its own review phase? See
*In a workflow* below — no review of your own. If you can't spawn subagents and nothing reviews
after you, self-review with the `review` skill and say "self-review only" in the PR Notes and in
your result — the orchestrator then runs an independent review. Otherwise spawn a
**separate subagent** (Agent tool) with:
"Run the `review` skill on branch `<branch>` for Linear task KBB-<n>; report findings only, don't
edit files." Then fix every must-fix and should-fix finding yourself, rerun step 5, and repeat the
review once if the fixes were substantial. Findings you consciously don't fix go to the PR's Notes.

## 7. Ship

Run the `ship` skill (commit, push, PR).

## 8. Merge (autonomous)

Merge only when **all** gates are green; otherwise leave the PR open and say why in the report:
- acceptance criteria met (or the unmet ones are explicitly out of scope and noted in the PR);
- no unresolved must-fix review findings;
- CI green **on the exact commit you merge**.

GitHub's merge queue isn't available on this repo, so use the soft queue script:

```bash
E2E_SPECS="e2e/route.spec.ts e2e/home.spec.ts" scripts/merge-pr.sh
  # rebase → push (CI starts) → local gate (lint, typecheck, unit, build, e2e of the given specs)
  # → fast CI green on that exact commit → main unchanged? → merge
```

CI only runs lint, typecheck and unit tests (fast); build and e2e run on this machine inside the
script, on the rebased commit, while CI runs on GitHub. Checks that haven't registered yet ("no
checks reported") mean "wait" (up to `CHECKS_WAIT`, 180 s), not red. Run it **in the foreground**
(Bash `timeout: 600000` — one round fits; if the timeout kills it, run it again), or in the
background followed by a Monitor until-loop — never background plus `sleep` polling. **E2E runs only the specs of the screens you changed**: pass them in
`E2E_SPECS` (paths relative to `apps/web`, no globs, or as arguments after the PR number). The script
adds the spec files changed vs `origin/main` (incl. their `-snapshots/`), and stops with an error
when the change can affect the UI — `apps/web` code (server and API too), public files, e2e helpers or
config, `packages/ui`, `packages/contracts` — but no spec is selected (an API-only change: name e.g.
`e2e/public-api.spec.ts`). A `*.prod.spec.ts` in
the list runs with `E2E_PROD=1` on the fresh build. `scripts/merge-pr.sh --print-specs` shows the
selection without running anything. It retries up to 3 rounds when `main` moves and exits non-zero (PR
stays open) on a rebase conflict, a red local gate or red CI. Fix, then run it again. Don't merge
by hand around it. Working on a differently named local branch (the PR's branch is checked out in
another worktree)? Pass the PR number: `E2E_SPECS="…" scripts/merge-pr.sh 42`.

**Evidence:** before merging, attach the main evidence screenshot(s) from
`apps/web/test-results/evidence/` to the Linear task (`prepare_attachment_upload` →
`create_attachment_from_upload`) and mention it in the PR body. If Linear tools aren't available
to you, say in the PR that evidence exists locally and describe what it shows.

If the rebase conflicts with someone else's recent work in a way you can't resolve confidently,
stop and report instead of merging.

## 9. Report

- Don't change the status: opening the PR moves the task to `In Review` and merging moves it to
  `Done` (GitHub integration). Check the PR got the Linear bot comment; if not, the branch/title
  lacks `KBB-<n>`.
- Linear comment (2–4 lines, like a teammate): what's done, PR link, anything left or blocking.
- To the user: PR link, merged or not (and why), acceptance-criteria checklist, review findings left
  open, what wasn't verified, proposed follow-up tasks.

## In a workflow

When an orchestrator splits the task into phases (implement → review → fixes + merge):
- **Implementing agent:** steps 0–5 and 7 (PR opened); skip step 6 — no self-review, the workflow's
  review phase does it. Report the worktree path, the branch and the e2e specs you ran (step 8's
  `E2E_SPECS`).
- **Fixes and merge happen in the implementation worktree, on the same branch** (`<type>/KBB-<n>`):
  either the implementing agent gets the review findings, or the fixing agent works in that worktree
  (absolute paths). No new worktree, no new `-fix`/`-review` branch, no fresh `npm ci` — the PR is
  found by its branch, and `merge-pr.sh` reinstalls only when the lockfile changed.
- Then step 5 for what the fixes touched, `ship` (same PR), step 8 and step 9.
