#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-https://melakulms.github.io/mela-app/}"
SUPABASE_URL="${SUPABASE_URL:-https://duizgtmbptmlbyipreqg.supabase.co}"
SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-}"
AUTH_STATUS_URL="${AUTH_STATUS_URL:-$SUPABASE_URL/functions/v1/mela-auth-status}"
BETA_AUTH_URL="${BETA_AUTH_URL:-$SUPABASE_URL/functions/v1/mela-beta-auth}"
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

check_beta_auth() {
  echo "Checking invite-only zero-budget beta authentication service"
  local payload
  payload="$(curl "${curl_common[@]}" \
    -X POST \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
    -H "Content-Type: application/json" \
    -H "Origin: https://melakulms.github.io" \
    --data '{"action":"status"}' \
    "$BETA_AUTH_URL")"
  BETA_AUTH_PAYLOAD="$payload" python - <<'PY'
import json, os, sys
try:
    data = json.loads(os.environ['BETA_AUTH_PAYLOAD'])
except Exception as exc:
    raise SystemExit(f"beta auth status response is not valid JSON: {exc}")
required = {
    'enabled': True,
    'mode': 'invite_only',
    'requires_email': False,
}
errors = [f"{key}={data.get(key)!r} (expected {expected!r})" for key, expected in required.items() if data.get(key) != expected]
if errors:
    print('Beta authentication readiness check failed:', file=sys.stderr)
    for error in errors:
        print(f'- {error}', file=sys.stderr)
    raise SystemExit(1)
print('Beta authentication service is live in invite-only, no-email mode.')
PY
}

check_data() {
  echo "Checking application Data API access through platform_languages"
  curl "${curl_common[@]}" --output /dev/null \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
    -H "Accept: application/json" \
    "$SUPABASE_URL/rest/v1/platform_languages?select=language_code&enabled=eq.true&limit=1"
}

check_privacy() {
  echo "Checking anonymous access cannot read private MELA accounts or teacher review records"
  local table code payload
  for table in profiles student_profiles parent_profiles teacher_profiles company_profiles mela_question_assignments mela_question_reviews; do
    payload="$(mktemp)"
    code="$(curl --silent --show-error --connect-timeout 10 --max-time 30 \
      --header "apikey: $SUPABASE_PUBLISHABLE_KEY" \
      --header "Accept: application/json" \
      --output "$payload" --write-out '%{http_code}' \
      "$SUPABASE_URL/rest/v1/$table?select=*&limit=1")"
    if [[ "$code" == '200' ]]; then
      # An empty JSON array is a successful deny-by-RLS result. Never print rows.
      if ! python -c 'import json,sys; sys.exit(0 if json.load(open(sys.argv[1])) == [] else 1)' "$payload"; then
        rm -f "$payload"
        echo "::error::Anonymous request returned data or an unexpected response from $table." >&2
        return 1
      fi
    elif [[ "$code" != '401' && "$code" != '403' ]]; then
      rm -f "$payload"
      echo "::error::Unexpected $code response checking anonymous privacy for $table." >&2
      return 1
    fi
    rm -f "$payload"
  done
  echo "Anonymous account and reviewer access: denied in every checked table."
}

case "$TARGET" in
  app) check_app ;;
  auth) check_auth ;;
  auth-settings) check_auth_settings ;;
  beta-auth) check_beta_auth ;;
  data) check_data ;;
  privacy) check_privacy ;;
  all) check_app; check_auth; check_auth_settings; check_beta_auth; check_data; check_privacy ;;
  *) echo "Unknown smoke target: $TARGET" >&2; exit 2 ;;
esac
