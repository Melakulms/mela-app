#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-https://melakulms.github.io/mela-app/}"
SUPABASE_URL="${SUPABASE_URL:-https://duizgtmbptmlbyipreqg.supabase.co}"
SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-}"
AUTH_STATUS_URL="${AUTH_STATUS_URL:-$SUPABASE_URL/functions/v1/mela-auth-status}"
TARGET="${1:-all}"

if [[ -z "$SUPABASE_PUBLISHABLE_KEY" ]]; then
  echo "SUPABASE_PUBLISHABLE_KEY is required" >&2
  exit 1
fi

curl_common=(--fail --silent --show-error --location --retry 5 --retry-delay 3 --retry-all-errors --connect-timeout 10 --max-time 30)

check_app() {
  echo "Checking deployed learner app: $APP_URL"
  curl "${curl_common[@]}" --output /dev/null "$APP_URL"
}

check_auth() {
  echo "Checking Supabase Auth health"
  curl "${curl_common[@]}" --output /dev/null -H "apikey: $SUPABASE_PUBLISHABLE_KEY" "$SUPABASE_URL/auth/v1/health"
}

check_auth_settings() {
  echo "Checking launch-critical Auth settings"
  local payload
  payload="$(curl "${curl_common[@]}" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Accept: application/json" "$AUTH_STATUS_URL")"
  AUTH_STATUS_PAYLOAD="$payload" python - <<'PY'
import json, os, sys
try:
    data = json.loads(os.environ['AUTH_STATUS_PAYLOAD'])
except Exception as exc:
    raise SystemExit(f"auth status response is not valid JSON: {exc}")
required = {
    'ok': True,
    'email_enabled': True,
    'signup_enabled': True,
    'autoconfirm': False,
}
errors = [f"{key}={data.get(key)!r} (expected {expected!r})" for key, expected in required.items() if data.get(key) is not expected]
if errors:
    print('Launch-critical Auth configuration check failed:', file=sys.stderr)
    for error in errors:
        print(f'- {error}', file=sys.stderr)
    raise SystemExit(1)
print('Auth configuration is fail-closed: email signup enabled and email autoconfirm disabled.')
PY
}

check_data() {
  echo "Checking application Data API access through platform_languages"
  curl "${curl_common[@]}" --output /dev/null \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
    -H "Accept: application/json" \
    "$SUPABASE_URL/rest/v1/platform_languages?select=language_code&enabled=eq.true&limit=1"
}

case "$TARGET" in
  app) check_app ;;
  auth) check_auth ;;
  auth-settings) check_auth_settings ;;
  data) check_data ;;
  all) check_app; check_auth; check_auth_settings; check_data ;;
  *) echo "Unknown smoke target: $TARGET" >&2; exit 2 ;;
esac
