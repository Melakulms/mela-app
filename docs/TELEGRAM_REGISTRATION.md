# Public Telegram registration

The existing public app at https://melakulms.github.io/mela-app/ uses the original production Supabase project. Its registration form opens @Mela_edu_bot with a username and one of the four existing public account roles. An authenticated private bot update issues a ten-minute, single-use registration code. The user copies it into the existing registration form and saves the separate recovery code after account creation.

Verification means control of a Telegram account, not legal identity, current phone possession, guardian consent, professional qualifications, or payment approval. Existing role and safeguarding checks remain applicable. Codes do not recover an existing email account or merge accounts. One Telegram account can verify one new MELA account; existing users should sign in normally.

## Deployment order

1. Apply `20261101051417_telegram_registration_codes.sql` to the public app's database.
2. Deploy `mela-beta-auth` with the username binding check.
3. Deploy `mela-telegram-bot` with `registration.ts` included. Keep its existing bot token, webhook secret, payment logic and webhook URL.
4. Publish the React form through the existing GitHub Pages workflow.

Both edge handlers retain their existing authentication model. Public signup uses a high-entropy invitation/code and rate limits; Telegram uses its existing secret-token webhook authentication and private-chat sender checks. The new table and issuance RPC are available only to `service_role`; RLS is enabled with no user policies. Code plaintext is returned to the bot once and only its hash is retained. Reissuing revokes the old invitation before issuing a new one, under a transaction lock shared with signup's invite row update.

## Validation

The SQL checks run in a staging transaction that is rolled back. They cover grants, expiry, rotation, duplicate Telegram identity, and prohibited roles. Handler tests cover username mismatch before consume, fail-closed lookup errors, trusted verification metadata, and existing invitation compatibility. UI/parser tests cover valid roles, malformed input, long usernames and the Telegram deep link.

A real user's private Telegram delivery and subsequent first login must be confirmed by that user. Automated handler tests do not substitute for this check.

## Rollback

Revert the React changes and redeploy the previous bot source to stop new code issuance. Keep the binding check in `mela-beta-auth` while any issued codes remain valid; removing it could remove username binding from an outstanding code. Retain verification records and existing users. Do not drop the table or revoke unrelated administrator invitations. No payment settings are changed by this release.
