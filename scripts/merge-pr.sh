#!/usr/bin/env bash
# Soft merge queue for agents (GitHub's merge queue isn't available on this repo).
# Runs the full gate LOCALLY (lint, typecheck, unit, build, e2e) on the rebased commit, then merges
# only when the fast CI is green on that same commit and main hasn't moved.
# Exit codes: 0 merged, 1 local gate / CI red / conflict / gave up (PR stays open).
set -euo pipefail

MAX_ROUNDS="${MAX_ROUNDS:-3}"
# Optional PR number: lets you merge from a local branch with another name (e.g. when the PR's
# branch is checked out in a sibling worktree). Default: the PR of the current branch.
PR="${1:-$(gh pr view --json number -q .number)}"
HEAD_REF="$(gh pr view "$PR" --json headRefName -q .headRefName)"
log="$(mktemp)"
trap 'rm -f "$log"' EXIT

for round in $(seq 1 "$MAX_ROUNDS"); do
  echo "── round $round/$MAX_ROUNDS"
  git fetch origin --quiet
  if ! git rebase origin/main; then
    git rebase --abort || true
    echo "rebase conflict — resolve it, rerun local checks, then run this script again"
    exit 1
  fi
  head="$(git rev-parse HEAD)"
  # Reinstall only when the lockfile changed; `npm ci` never rewrites package-lock.json.
  lock_hash="$(git hash-object package-lock.json)"
  if [ "$(cat node_modules/.lock-hash 2>/dev/null)" != "$lock_hash" ]; then
    npm ci --no-audit --no-fund --silent
    echo "$lock_hash" > node_modules/.lock-hash
  fi
  # Generated contract types are gitignored; regenerate so a teammate's spec change isn't stale here.
  npm run contracts:generate --silent

  echo "local gate on $head"
  if ! { npm run lint && npm run typecheck && npm run test && npm run build && E2E_PROD=1 npm run test:e2e; } >"$log" 2>&1; then
    tail -40 "$log"
    echo "local gate red on $head — fix it, then run this script again"
    exit 1
  fi

  if [ "$(git ls-remote origin "refs/heads/$HEAD_REF" | cut -f1)" != "$head" ]; then
    git push --force-with-lease="$HEAD_REF" --quiet origin "HEAD:refs/heads/$HEAD_REF"
  fi

  # Wait until GitHub sees the pushed commit as the PR head, then for its checks to register.
  for _ in $(seq 1 60); do
    [ "$(gh pr view "$PR" --json headRefOid -q .headRefOid)" = "$head" ] && break
    sleep 5
  done
  sleep 10

  if ! gh pr checks "$PR" --watch --fail-fast --interval 10; then
    echo "CI red on $head — fix it, then run this script again"
    exit 1
  fi

  git fetch origin --quiet
  if ! git merge-base --is-ancestor origin/main "$head"; then
    echo "main moved while CI ran — next round"
    continue
  fi

  gh pr merge "$PR" --merge --delete-branch --match-head-commit "$head"
  echo "merged $head"
  exit 0
done

echo "main kept moving for $MAX_ROUNDS rounds — leaving the PR open"
exit 1
