#!/usr/bin/env bash
# Soft merge queue for agents (GitHub's merge queue isn't available on this repo).
# Merges the current branch's PR only when CI is green on a commit that already contains the
# latest origin/main. Exit codes: 0 merged, 1 CI red / conflict / gave up (PR stays open).
set -euo pipefail

MAX_ROUNDS="${MAX_ROUNDS:-3}"

for round in $(seq 1 "$MAX_ROUNDS"); do
  echo "── round $round/$MAX_ROUNDS"
  git fetch origin --quiet
  before="$(git rev-parse HEAD)"
  if ! git rebase origin/main; then
    git rebase --abort || true
    echo "rebase conflict — resolve it, rerun local checks, then run this script again"
    exit 1
  fi
  head="$(git rev-parse HEAD)"
  if [ "$head" != "$before" ] || [ "$(git rev-parse "@{u}" 2>/dev/null)" != "$head" ]; then
    echo "rebased onto new main — rerun local checks before trusting CI" >&2
    git push --force-with-lease --quiet
  fi

  # Wait until GitHub sees the pushed commit as the PR head, then for its checks to register.
  for _ in $(seq 1 60); do
    [ "$(gh pr view --json headRefOid -q .headRefOid)" = "$head" ] && break
    sleep 5
  done
  sleep 10

  if ! gh pr checks --watch --fail-fast --interval 10; then
    echo "CI red on $head — fix it, then run this script again"
    exit 1
  fi

  git fetch origin --quiet
  if ! git merge-base --is-ancestor origin/main "$head"; then
    echo "main moved while CI ran — next round"
    continue
  fi

  gh pr merge --merge --delete-branch --match-head-commit "$head"
  echo "merged $head"
  exit 0
done

echo "main kept moving for $MAX_ROUNDS rounds — leaving the PR open"
exit 1
