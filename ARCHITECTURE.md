# MELA App — Architecture Notes (read this before making changes)

For any AI tool or developer picking this up: this file exists so you don't have
to reverse-engineer the backend from scratch. Read it before editing.

## Stack
React 19 + Vite + TypeScript. No router library — navigation is plain React state
(`studentView` in `App.tsx`). Styling is one file: `src/styles.css`, CSS variables,
no framework.

## Backend
Supabase project `duizgtmbptmlbyipreqg`. Client lives in `src/lib/supabase.ts`,
reading `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` from env.

**Hard rule: never guess a table/column name or an RPC's parameter names.** Every
data-access function in `src/lib/*.ts` was written only after querying the real
schema (`information_schema.columns`) or reading the actual function source
(`pg_get_functiondef`) via the Supabase project directly. Several early guesses in
this codebase's history were wrong in ways that silently broke things (a status
value that looked right but wasn't in the CHECK constraint, a column that doesn't
exist). If you add a new feature touching the database, verify the real schema
first — don't pattern-match from a similar-looking table.

## Roles
`profiles.role` is one of: `student`, `parent`, `teacher`, `company`, `employer`
(also `admin`, `mentor`, `partner` — not used by this app's UI yet). `company` is
the pending-approval state for a new employer signup; the database automatically
promotes it to `employer` once an admin approves the registration request. Don't
conflate the two.

## What's real vs. not yet built
Every screen currently in the app talks to real Supabase tables/RPCs — nothing is
mocked. But "built" is not the same as "every sub-section of every module is
complete." Known shallow spots, honestly:
- **Arena**: matchmaking, cancel, and the leaderboard are live-tested. The
  round-by-round live match screen is built against the real function contracts
  but has never run against an actual live match (none has been played yet).
- **Parent and teacher roles**: can register, verify, and log in, but land on a
  placeholder screen. No dashboard built for them yet.
- **Employer Portal**: registration → approval → posting → viewing applicants all
  work. No messaging/communication with candidates yet.
- **Sponsored Challenges, EthioScholar Connect, Earn & Work**: shown on the
  dashboard as visual tiles (matching the reference design) but have no dedicated
  screens yet — tapping them does nothing.
- Only English is currently translated in the UI text itself; the language
  switcher updates `profiles.preferred_language` for real, but the app's own
  strings aren't localized yet.

## Deployment
GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys to GitHub Pages
on every push to `main`. No manual deploy step. Supabase URL and publishable key
are hardcoded in the workflow file (the publishable key is meant to be public —
it's not a secret, it's protected by Supabase RLS on the backend).


## Verification

Production-readiness work is validated through the main GitHub Actions build before release.
