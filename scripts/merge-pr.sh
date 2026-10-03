#!/usr/bin/env bash
# Soft merge queue for agents (GitHub's merge queue isn't available on this repo).
# Runs the local gate (lint, typecheck, unit, build, e2e of the touched screens) on the rebased commit,
# then merges only when the fast CI is green on that same commit and main hasn't moved.
#
# Usage: [E2E_SPECS="e2e/a.spec.ts e2e/b.prod.spec.ts"] scripts/merge-pr.sh [PR-number] [spec ...]
#        scripts/merge-pr.sh --print-specs [spec ...]   # show the e2e selection for HEAD vs origin/main, run nothing
# E2E specs (paths relative to apps/web, no globs): the ones given (args or E2E_SPECS) plus the spec files changed
# vs origin/main (a changed `<name>.spec.ts-snapshots/` counts as its spec). A change that can affect the UI
# (apps/web code, public, e2e helpers or config, packages/ui, packages/contracts) with no spec selected is an
# error: name the specs of the screens you changed. The full suite never runs by default.
# *.prod.spec.ts run (with E2E_PROD=1, on the fresh build) only when selected.
# Exit codes: 0 merged, 1 local gate / CI red / conflict / no specs for a UI change / gave up (PR stays open).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
MAX_ROUNDS="${MAX_ROUNDS:-3}"
WEB_DIR="apps/web"

print_only=0
PR=""
given="${E2E_SPECS:-}"
for arg in "$@"; do
  case "$arg" in
    --print-specs) print_only=1 ;;
    *[!0-9]*) given="$given $arg" ;;
    *) PR="$arg" ;;
  esac
done

# What the dev-server specs render: app code, its static files and config, the e2e helpers, shared UI and the
# contract (its examples are the specs' sample data).
UI_PATHS="^($WEB_DIR/(src|public|e2e)/|$WEB_DIR/[^/]+\.(ts|mjs|json)\$|packages/(ui|contracts)/)"

# Prints the selected specs (one per line, relative to apps/web): the given ones plus the changed ones.
# Fails when a given spec is missing, or when the change can affect the UI and nothing is selected.
select_specs() {
  local changed spec specs=""
  set -f
  for spec in $given; do
    spec="${spec#./}"
    spec="${spec#"$WEB_DIR"/}"
    if [ ! -f "$WEB_DIR/$spec" ]; then
      set +f
      echo "E2E spec not found: $WEB_DIR/$spec (paths relative to $WEB_DIR, no globs)" >&2
      return 1
    fi
    specs="$specs$spec"$'\n'
  done
  set +f
  changed="$(git diff --name-only --diff-filter=d origin/main...HEAD)"
  for spec in $(printf '%s\n' "$changed" \
    | sed -n -e "s#^$WEB_DIR/\(e2e/.*\.spec\.ts\)\$#\1#p" -e "s#^$WEB_DIR/\(e2e/[^/]*\.spec\.ts\)-snapshots/.*#\1#p"); do
    if [ -f "$WEB_DIR/$spec" ]; then specs="$specs$spec"$'\n'; fi
  done
  if [ -z "${specs//$'\n'/}" ] && printf '%s\n' "$changed" | grep -qE "$UI_PATHS"; then
    echo "This change can affect the UI (app code, e2e helpers, packages/ui or the contract) but no e2e spec changed." >&2
    echo "Name the specs of the screens you changed, e.g.: E2E_SPECS=\"e2e/route.spec.ts\" scripts/merge-pr.sh" >&2
    return 1
  fi
  printf '%s' "$specs" | sed '/^$/d' | sort -u
}

if [ "$print_only" = 1 ]; then
  select_specs
  exit $?
fi

# Optional PR number: lets you merge from a local branch with another name (e.g. when the PR's
# branch is checked out in a sibling worktree). Default: the PR of the current branch.
PR="${PR:-$(gh pr view --json number -q .number)}"
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

  if ! specs="$(select_specs)"; then
    exit 1
  fi
  dev_specs="$(printf '%s\n' "$specs" | grep -v '\.prod\.spec\.ts$' || true)"
  prod_specs="$(printf '%s\n' "$specs" | grep '\.prod\.spec\.ts$' || true)"
  e2e_prod=""
  [ -n "$prod_specs" ] && e2e_prod=1
  if [ -n "$specs" ]; then
    echo "e2e specs:" $specs
  else
    echo "e2e: no UI change and no spec selected — skipping e2e"
  fi

  # Reinstall only when the lockfile changed; `npm ci` never rewrites package-lock.json.
  lock_hash="$(git hash-object package-lock.json)"
  if [ "$(cat node_modules/.lock-hash 2>/dev/null)" != "$lock_hash" ]; then
    npm ci --no-audit --no-fund --silent
    echo "$lock_hash" > node_modules/.lock-hash
  fi
  # Generated contract types are gitignored; regenerate so a teammate's spec change isn't stale here.
  npm run contracts:generate --silent

  echo "local gate on $head"
  # $specs is intentionally unquoted: one argument per spec path (paths have no spaces).
  # shellcheck disable=SC2086
  if ! {
    npm run lint && npm run typecheck && npm run test && npm run build \
      && { [ -z "$specs" ] || E2E_PROD="$e2e_prod" npm run test:e2e -- $dev_specs $prod_specs; }
  } >"$log" 2>&1; then
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
