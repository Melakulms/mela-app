#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-https://melakulms.github.io/mela-app/}"
SUPABASE_URL="${SUPABASE_URL:-https://duizgtmbptmlbyipreqg.supabase.co}"
SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-}"

if [[ -z "$SUPABASE_PUBLISHABLE_KEY" ]]; then
  echo "SUPABASE_PUBLISHABLE_KEY is required" >&2
  exit 1
fi

curl_common=(--fail --silent --show-error --location --retry 8 --retry-delay 5 --retry-all-errors --connect-timeout 10 --max-time 30)

echo "Checking deployed learner app: $APP_URL"
curl "${curl_common[@]}" --head "$APP_URL" >/dev/null

echo "Checking Supabase Auth health"
curl "${curl_common[@]}" "$SUPABASE_URL/auth/v1/health" >/dev/null

echo "Checking Supabase Data API availability"
curl "${curl_common[@]}" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" "$SUPABASE_URL/rest/v1/" >/dev/null

echo "Production smoke checks passed"
