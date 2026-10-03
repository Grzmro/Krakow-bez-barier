---
name: ship
description: Commit the relevant changes, push the branch and open (or update) a GitHub PR using the repo conventions. Use whenever you're about to `git commit` or open a PR, or on "ship it", "commit and push", "wypchnij", "zrób PR".
---

# Ship — commit, push, PR

## 1. Pre-flight

- Not on `main`. If you are, stop and create a branch (`<type>/KBB-<n>`) — never push to `main`.
- Lint, typecheck and unit tests of affected apps pass (build only per `task` step 5), plus the e2e specs of the screens you
  changed (`npm run test:e2e -- e2e/<screen>.spec.ts`; not the full suite).
- No debug logs, no secrets, no `.env` in the diff.

## 2. Commit

Stage only files relevant to the task — by path, never `git add -A` / `git add .`.

```
<type>(KBB-<n>): <imperative summary, English, ≤ 72 chars>

Why this change: motivation, notable decisions and trade-offs,
known gaps or follow-ups. Wrap at ~72 chars.
```

- Types: `feat` `fix` `refactor` `perf` `test` `docs` `chore` `build` `ci` `style` `revert`.
- Scope is the task ID; without a task, a one-word area (`chore(tooling): ...`).
- The body is required unless the commit is a typo, formatting or dependency bump.
- Use a HEREDOC or several `-m` flags. Never `--no-verify`; if a hook fails, fix the cause.

## 3. Push

```bash
git fetch origin && git rebase origin/main     # resolve conflicts in the rebase, don't merge
git push -u origin HEAD                        # after a rebase of a pushed branch: --force-with-lease
```

## 4. PR

If a PR already exists for the branch, update its description instead of opening a new one.

```bash
gh pr create --base main --title "KBB-12: Add user registration endpoint" --body "$(cat <<'BODY'
**Linear:** https://linear.app/<workspace>/issue/KBB-12

## What changed
- ...

## How to test
1. ...

## Notes
Not verified / known gaps / follow-up tasks (if any).
BODY
)"
```

- Title: `KBB-<n>: <Sentence case title>` — English, no `type(scope)` prefix, no trailing period.
- Get the Linear URL from `get_issue`.
- Merging is the `task` skill's step 8 (autonomous, only when all gates are green). Called on its
  own, `ship` stops at the PR.
