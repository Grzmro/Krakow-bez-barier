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

## 1. Understand

- `get_issue` and `list_comments` — comments often carry the final decisions.
- Read `docs/challenge.md` (requirements this task serves), `docs/architecture.md`, and the files listed for your area in `AGENTS.md` → *Read before you start*
  (rules and context files).
- If the task is ambiguous or its acceptance criteria contradict the code, ask — don't guess.
- Set the task to `In Progress`.

## 2. Branch

```bash
git fetch origin
git branch -a | grep -i "KBB-12"          # does a branch already exist?
git switch -c feat/KBB-12 origin/main      # type: feat | fix | refactor | chore | docs | test
```

If the working tree has someone else's uncommitted work, use a worktree instead:
`git worktree add ../Krak-w-bez-barier-KBB-12 -b feat/KBB-12 origin/main`.

## 3. Plan

For anything bigger than a one-file change, write a short plan first: files to touch, the
contract changes in `packages/`, tests to add. Map every acceptance criterion to a step.
Out-of-scope findings go to a list for the final report (propose tasks via `new-task`), not
into the diff.

## 4. Implement

Follow `AGENTS.md` hard rules. Small, coherent commits as you go (see `ship` for the format).

## 5. Verify

- Build, lint, typecheck and tests of every affected app pass (commands in root `AGENTS.md` → Commands).
- New business logic and endpoints have tests (`// GIVEN` / `// WHEN` / `// THEN`).
- **UI changed → Playwright smoke** (`npm run test:e2e`): add or extend a spec in `apps/web/e2e/`
  that clicks the main path of your screen (open, key interaction, keyboard-only pass) and saves a
  screenshot. Look at the screenshot and compare it with the matching screen in
  `design/prototype-b/` — fix obvious visual gaps.
- **API changed** → hit the endpoint (curl or a test) and check the response against `openapi.yaml`.
- Tick every acceptance criterion — or state explicitly which one isn't met and why.

## 6. Independent review

Fresh eyes catch what the author misses. Spawn a **separate subagent** (Agent tool) with:
"Run the `review` skill on branch `<branch>` for Linear task KBB-<n>; report findings only, don't
edit files." Then fix every must-fix and should-fix finding yourself, rerun step 5, and repeat the
review once if the fixes were substantial. Findings you consciously don't fix go to the PR's Notes.

## 7. Ship

Run the `ship` skill (commit, push, PR).

## 8. Merge (autonomous)

Merge only when **all** gates are green; otherwise leave the PR open and say why in the report:
- acceptance criteria met (or the unmet ones are explicitly out of scope and noted in the PR);
- no unresolved must-fix review findings;
- CI checks green (`gh pr checks --watch`); while the repo has no CI yet, the step-5 checks run
  locally after the final rebase.

```bash
git fetch origin && git rebase origin/main   # conflicts: resolve, keep both sides' intent; rerun step 5
git push --force-with-lease
gh pr checks --watch                          # skip only if the repo has no CI yet
gh pr merge --merge --delete-branch
```

If the rebase conflicts with someone else's recent work in a way you can't resolve confidently,
stop and report instead of merging.

## 9. Report

- Don't change the status: opening the PR moves the task to `In Review` and merging moves it to
  `Done` (GitHub integration). Check the PR got the Linear bot comment; if not, the branch/title
  lacks `KBB-<n>`.
- Linear comment (2–4 lines, like a teammate): what's done, PR link, anything left or blocking.
- To the user: PR link, merged or not (and why), acceptance-criteria checklist, review findings left
  open, what wasn't verified, proposed follow-up tasks.
