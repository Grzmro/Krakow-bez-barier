---
name: task
description: End-to-end delivery of one Linear task (KBB-<n>) — read the task, set In Progress, branch, plan, implement, verify, self-review, commit, push, open a PR, comment in Linear. Use for "/task KBB-12", "do KBB-12", "zrób taska KBB-12", "weź KBB-12", "ogarnij KBB-12 od początku do końca".
---

# Task — one Linear task → one PR

Invoking this skill authorizes: creating the branch, commits, pushing that branch, opening a PR,
changing the task status to `In Progress`, and one short Linear comment.
Never: merge a PR, push to `main`, move a task to `Done`, create new Linear tasks without asking.

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
- Actually run it: hit the endpoint / open the screen. If you can't verify something, say so.
- Tick every acceptance criterion — or state explicitly which one isn't met and why.

## 6. Review

Run the `review` skill on the branch and fix every must-fix finding.

## 7. Ship

Run the `ship` skill (commit, push, PR).

## 8. Report

- Set the task to `In Review`.
- Linear comment (2–4 lines, like a teammate): what's done, PR link, anything left or blocking.
- To the user: PR link, acceptance-criteria checklist, what wasn't verified, proposed follow-up tasks.
