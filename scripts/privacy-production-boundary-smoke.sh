#!/usr/bin/env bash
# Unauthenticated production privacy boundary smoke. Read-only against MELA.
# Do not submit, cancel, export, or modify actual user requests here.
set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL required}"
: "${SUPABASE_PUBLISHABLE_KEY:?SUPABASE_PUBLISHABLE_KEY required}"
: "${EXPECTED_SHA:?EXPECTED_SHA required}"

learner="https://melakulms.github.io/mela-app/"
admin="https://central-dashboard-gamma.vercel.app/Mela-central-dashboard-/"
legacy="https://melakulms.github.io/Mela-central-dashboard-/admin-origin-redirect.js"
api="${SUPABASE_URL%/}/rest/v1"

if [[ ! "$EXPECTED_SHA" =~ ^[a-f0-9]{40}$ ]]; then
  echo "::error::Expected release SHA must be 40 lower-case hex characters" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

# Confirm the anonymous/public key works on a known safe, public endpoint.
# A broken API key must not be counted as successful denied access.
public_http="$(curl -sS --max-time 20 -o "$tmp_dir/public.json" -w '%{http_code}' \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H 'Accept: application/json' \
  "$api/platform_languages?select=language_code&enabled=eq.true&limit=1")"
if [[ "$public_http" != 200 ]]; then
  echo "::error::Public Data API health returned $public_http; cannot establish valid key" >&2
  exit 1
fi

# These two tables are private. Anonymous visitors must be refused.
# If a security regression exposes data, do not echo the response body to CI logs.
for relation in data_subject_requests privacy_review_checkpoints; do
  http="$(curl -sS --max-time 20 -o "$tmp_dir/$relation.json" -w '%{http_code}' \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H 'Accept: application/json' \
    "$api/$relation?select=id&limit=1")"
  case "$http" in
    401|403) printf 'Anonymous SELECT denied for %s (HTTP %s)\n' "$relation" "$http" ;;
    *) echo "::error::Anonymous private-table SELECT is not denied: $relation (HTTP $http)" >&2; exit 1 ;;
  esac
done

# Unauthenticated privileged Edge Functions must never return a success response.
admin_api_status="$(curl -sS --max-time 20 -o "$tmp_dir/admin-api.json" -w '%{http_code}' \
  -X POST -H 'Content-Type: application/json' \
  -d '{"action":"me"}' "${SUPABASE_URL%/}/functions/v1/mela-admin-api")"
if [[ "$admin_api_status" != 401 && "$admin_api_status" != 403 ]]; then
  echo "::error::Unauthenticated admin API returned HTTP $admin_api_status" >&2
  exit 1
fi

# Confirm learner production Pages is actually serving the expected main commit.
curl -fsSL --retry 3 --retry-delay 3 --max-time 20 \
  -H 'Cache-Control: no-cache' "${learner}mela-release.json?privacy-smoke=$EXPECTED_SHA" \
  -o "$tmp_dir/learner-release.json"
actual_sha="$(jq -r '.commit // empty' "$tmp_dir/learner-release.json")"
if [[ "$actual_sha" != "$EXPECTED_SHA" ]]; then
  echo "::error::Learner release drift: expected $EXPECTED_SHA; live $actual_sha" >&2
  exit 1
fi

# GitHub Pages admin entry must redirect away from the shared learner origin,
# without forwarding a URL fragment/query that could contain credentials.
curl -fsSL --max-time 20 "$legacy" -o "$tmp_dir/admin-origin-redirect.js"
grep -Fq "window.location.replace('https://central-dashboard-gamma.vercel.app/Mela-central-dashboard-/')" \
  "$tmp_dir/admin-origin-redirect.js"
if grep -Eq 'window\.location\.(search|hash)' "$tmp_dir/admin-origin-redirect.js"; then
  echo "::error::Legacy admin redirect risks forwarding URL credentials" >&2
  exit 1
fi

# Check the separate admin hostname and browser-delivered security boundaries.
curl -fsSL --retry 3 --retry-delay 3 --max-time 20 -D "$tmp_dir/admin-headers" \
  "$admin" -o "$tmp_dir/admin.html"
grep -Fq 'MELA Central Admin' "$tmp_dir/admin.html"
grep -Eiq "^content-security-policy:.*frame-ancestors 'none'" "$tmp_dir/admin-headers"
grep -Eiq '^x-frame-options: *DENY' "$tmp_dir/admin-headers"

echo "PASS: learner release SHA, isolated admin origin, private anon RLS boundaries, and unauthenticated admin API denial."
echo "NOTE: This unauthenticated smoke is NOT an authenticated end-to-end rights fulfillment test."
