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

## Working alongside another contributor
Another AI tool has been making real, independent changes to this same repo
(commits authored under this GitHub account). Confirmed and settled during one
merge, for future reference:
- **`profiles.preferred_language` stores the full language name** (`"English"`,
  `"Amharic"`), not a short code. Verified against real existing rows before
  settling this — don't assume otherwise from the signup trigger's own
  fallback default, which uses a code but is apparently never what's actually
  relied on in practice.
- **GitHub Pages requires `base: '/mela-app/'`** in `vite.config.ts`, not `'/'`
  — this repo has no custom domain (no CNAME), and `.github/workflows/deploy.yml`
  deploys to the project subpath `melakulms.github.io/mela-app/`, not the
  account root. A root-relative base will build successfully (no compile
  error) but 404 every asset on the live site. This has been reverted once
  already; if you see it changed to `/` again, check whether a custom domain
  or different host was actually set up before assuming it's a fix.
- `study_materials` (the table) is real but has an RLS policy of `USING
  (false)` for authenticated users — it cannot be read directly from the
  client under any circumstance, by design. The actual content lives behind
  `get_mela_learning_library(p_stage_key, ...)`, which returns a real
  programs → units → materials hierarchy with server-computed access flags.
  If a future edit points `StudyMaterials.tsx` back at the raw table, it will
  silently show empty forever, table content or not.
- Opportunity type values are `jobs`, `internships`, `scholarships`,
  `challenges`, `freelance` (plural, matching the real enum) — not the
  singular/human-sounding versions that seem intuitive. Verify against
  `pg_enum` before adding a new option here.

## Deployment
GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys to GitHub Pages
on every push to `main`. No manual deploy step. Supabase URL and publishable key
are hardcoded in the workflow file (the publishable key is meant to be public —
it's not a secret, it's protected by Supabase RLS on the backend).


## Verification

Production-readiness work is validated through the main GitHub Actions build before release.
