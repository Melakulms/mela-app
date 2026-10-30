# MELA Telegram staging backend

This backend serves the existing Telegram bot **@Mela_edu_bot**. It was deployed to Supabase **mela-staging**, not production, on 2026-10-30.

## Security boundary

- Payment collection is **off**, without exception. No payment references, screenshots, PINs or bank credentials are accepted.
- /start, /help, /pay, /verify, /status, /privacy respond in private chats only.
- No MELA account linking, subscription read, receipt processing, payment approval, or entitlement activation.
- Telegram webhook POST requires the Telegram setWebhook secret header.
- Setup request requires a separate header, x-mela-telegram-setup-secret, whose value must equal the webhook secret.
- Bot username is checked against `mela_edu_bot` before the webhook is registered.
- Supabase project URL is checked against the staging project; the function fails closed if it is deployed to another project.
- Do not add credentials to GitHub, screenshots, chat or frontend environment variables.

## Owner setup (phone compatible)

1. Open @BotFather on Telegram > `/mybots` > `@Mela_edu_bot` > API Token. Keep it private.
2. In **mela-staging** Supabase dashboard > Edge Functions > Secrets, set `MELA_TELEGRAM_BOT_TOKEN` to the BotFather API token.
3. In the same Secrets page, set `MELA_TELEGRAM_WEBHOOK_SECRET` to an independently generated random 32–64-character alphanumeric secret (hyphen/underscore also allowed). Do **not** use the bot token as this secret.
4. Open Edge Functions > `mela-telegram-bot` > Test. Send a POST to the function root with body `{}` and custom header `x-mela-telegram-setup-secret` equal to the generated webhook secret. This registers only the **fixed** MELA staging URL via Telegram's setWebhook; it cannot register an arbitrary URL.
5. Test `https://tungqfmypuwzeyrtaseh.supabase.co/functions/v1/mela-telegram-bot` using a browser GET. It should return `configured:true` and `payments_enabled:false` after secrets are set.
6. Open https://t.me/Mela_edu_bot and send `/start`. Expected: MELA staging welcome response.
7. Confirm `/pay`, `/verify`, and `/status` do **not** process payment or reveal a private account. Test an unsigned POST and check it is rejected.

If the Supabase Tester cannot include the setup header, use an authenticated REST client to POST the same header to `https://tungqfmypuwzeyrtaseh.supabase.co/functions/v1/mela-telegram-bot/setup`. Never put secrets into URL query parameters.

## Limitations

This is an interactive staging foundation, not a production payment processor. Telegram cannot verify real Telebirr or Ethiopian bank settlement without a trusted provider confirmation or separately authorized manual review with MFA. Account linking, anti-replay storage, and real settlements need a separate audited implementation and tests before payment activation.

The function was deployed with `verify_jwt=false` because Telegram webhooks do not carry Supabase JWTs; it rejects untrusted requests by checking the Telegram header secret. The Supabase dashboard exposes secrets via Deno.env.get after configuration. No database or production changes are required for this stage.
