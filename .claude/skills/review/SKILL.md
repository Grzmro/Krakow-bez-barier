---
name: review
description: Self-review of the current branch's changes against main before declaring a task done or opening a PR. Use when finishing a task, before `ship`, or on "review my changes", "przejrzyj zmiany", "zrób review".
---

# Review — self-review of the branch

Read-only analysis first, then fix. Report only findings you're confident in (>70%).

## 1. Get the diff

```bash
git fetch origin
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
git status --short          # uncommitted changes are part of the review too
```

Read the full changed files where the diff alone lacks context.

## 2. Check

**Must-fix** (block the PR):
- Bugs: wrong logic, unhandled errors, null/undefined access, missing `await`, race conditions.
- Security: secrets in code, missing auth/validation on endpoints, injection, user data in logs.
- Broken contract: an API change not reflected in `packages/` or in the other app using it.
- Hidden workaround: a hack without `TODO(KBB-<n>)`, fake data presented as real.
- Edited generated files; hardcoded URLs/ports/credentials.
- Acceptance criteria from the Linear task not met.

**Should-fix:**
- Duplicated logic where an existing helper/component would do.
- Missing tests for new business logic or endpoints.
- Unneeded comments, leftover debug logs, dead code, unrelated changes in the diff.
- Naming/structure inconsistent with the surrounding code.

## 3. Fix and re-verify

Fix all must-fix and should-fix findings (unless fixing is out of scope — then list it).
Rerun build, lint, typecheck and tests of affected apps.

## 4. Report

Short list: what was found, what was fixed, what's left and why.
