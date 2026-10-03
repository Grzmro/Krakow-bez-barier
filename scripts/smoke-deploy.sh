#!/usr/bin/env bash
# Checks a running deployment end to end: health with the database up, seeded sources and places,
# a place card and widget, the API docs and the read-only CORS headers.
# Usage: scripts/smoke-deploy.sh https://your-app.vercel.app
set -uo pipefail

base="${1:-}"
if [ -z "$base" ]; then
  echo "Usage: $0 <base-url>" >&2
  exit 2
fi
base="${base%/}"
failed=0

check() {
  local name="$1" ok="$2"
  if [ "$ok" = "1" ]; then echo "ok    $name"; else echo "FAIL  $name"; failed=1; fi
}

get() { curl -sS -m 20 -H "Accept: application/json" "$base$1"; }
json() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)" 2>/dev/null; }

# The first request after a quiet period can hit a sleeping database (Neon Free); retry before failing.
for attempt in 1 2 3 4 5; do
  health="$(get /api/v1/health)"
  [ "$(echo "$health" | json 'd["checks"]["database"]["status"]')" = "up" ] && break
  sleep 4
done
check "health: database up" "$([ "$(echo "$health" | json 'd["checks"]["database"]["status"]')" = "up" ] && echo 1 || echo 0)"

sources="$(get /api/v1/sources)"
check "sources: at least one, each with a status" "$([ "$(echo "$sources" | json 'len(d["items"]) > 0 and all(s["refreshStatus"] for s in d["items"])')" = "True" ] && echo 1 || echo 0)"

places="$(get '/api/v1/places?limit=5')"
id="$(echo "$places" | json 'd["items"][0]["id"]')"
check "places: the list has places" "$([ -n "$id" ] && echo 1 || echo 0)"

if [ -n "$id" ]; then
  card="$(get "/api/v1/places/$id")"
  check "place card: every attribute resolved with its facts" "$([ "$(echo "$card" | json 'len(d["attributes"]) > 0 and "sources" in d')" = "True" ] && echo 1 || echo 0)"
  widget="$(get "/api/v1/widget/$id")"
  check "widget: has an attribution" "$([ "$(echo "$widget" | json 'bool(d.get("attribution"))')" = "True" ] && echo 1 || echo 0)"
fi

check "categories: listed" "$([ "$(get /api/v1/categories | json 'len(d["items"]) > 0')" = "True" ] && echo 1 || echo 0)"
check "docs: /api/docs is served" "$([ "$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "$base/api/docs")" = "200" ] && echo 1 || echo 0)"
check "https: the address is secure" "$([ "${base:0:8}" = "https://" ] || [ "${base:0:16}" = "http://localhost" ] && echo 1 || echo 0)"

cors="$(curl -sS -m 20 -D - -o /dev/null "$base/api/v1/places" | tr -d '\r' | tr 'A-Z' 'a-z')"
check "cors: reads are open to other origins" "$(echo "$cors" | grep -q '^access-control-allow-origin: \*' && echo 1 || echo 0)"
post_cors="$(curl -sS -m 20 -D - -o /dev/null -X POST -H 'Content-Type: application/json' -d '{}' "$base/api/v1/reports" | tr -d '\r' | tr 'A-Z' 'a-z')"
check "cors: reports are not" "$(echo "$post_cors" | grep -q '^http/' && ! echo "$post_cors" | grep -q '^access-control-allow-origin' && echo 1 || echo 0)"

[ "$failed" = "0" ] && echo "All checks passed." || echo "Some checks failed."
exit "$failed"
