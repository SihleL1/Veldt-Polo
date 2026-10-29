# Schools Water Polo South Africa

A national platform for South African school water polo: public fixtures, results, live
scores and transparent national rankings — plus a dark operator-first live scoring
console, an admin competition console, and private coach/analyst dashboards.

## Quick start (local)

```bash
bun install
bun run dev        # http://localhost:5173
bun run test       # unit tests (engines) + browser tests
bun run build      # production build to dist/
```

Without Supabase credentials the app runs in **demonstration mode**: a clearly-labelled
2021 proof-of-concept dataset stored in `localStorage`. Every page shows a banner, and
nothing pretends to be official. Demo sign-ins (password `demo1234`) are listed on the
login page — administrator, scorekeeper, coach and analyst views.

## Connecting your Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Set the environment variables (a `.env.local` in this folder, or your host's env settings):

   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon public key>
   ```

   The **anon key is safe for client bundles** — Row Level Security is the real gate.
   The **service-role key must never appear in client code or `.env.local` used by the app**.
3. Run the migrations in order, from the Supabase SQL editor or CLI:

   ```
   backend/migrations/001_schema.sql     — tables, indexes, triggers
   backend/migrations/002_functions.sql  — RPCs (clock, events, undo, finalise, users, roles)
   backend/migrations/003_rls.sql        — Row Level Security policies + auth trigger
   backend/migrations/004_seed.sql       — event catalogue + first-admin notes
   ```

   With the CLI: `supabase link --project-ref <ref>` then `supabase db push`.
4. Enable **Email + password** auth in Supabase (Authentication → Providers).
   New sign-ups get a `user_profiles` row automatically via trigger.
5. Promote your first admin (Supabase SQL editor):

   ```sql
   insert into role_assignments (user_id, role, granted_by)
   select id, 'admin', 'bootstrap' from user_profiles where email = 'you@example.org'
   on conflict (user_id, role) do nothing;
   ```

6. Restart `bun run dev` — the app detects the credentials, the demo banner disappears,
   and all data flows through the Supabase repository (`src/lib/data/supabase/supaRepo.ts`).

## Architecture

- **Domain layer** (`src/lib/domain/`) — pure, unit-tested engines: statistics,
  rankings (versioned, weighted, eligibility-aware), clock maths, event catalogue.
- **Data layer** (`src/lib/data/`) — one `AppRepo` interface with two implementations:
  demo (localStorage) and Supabase. Screens never touch the database directly.
  Scoring integrity (sequence assignment, score consequences, undo reversal, finalise
  reconciliation) lives in database functions, not the client.
- **Auth** (`src/lib/auth.tsx`) — native Supabase Auth in production; demo session in
  demonstration mode. Roles: admin, tournament_admin, scorekeeper, coach, analyst —
  enforced by RLS on every table, independent of the UI.

## Honest-data rules

- Demonstration data is labelled everywhere it appears; verified results are marked with
  their verification state (`verified` / `unverified` / `disputed`).
- Disputed matches are excluded from rankings and statistics by definition.
- Score/event reconciliation is checked at finalisation; the data-quality screen
  reports mismatches rather than estimating around them.

## Later phases (schema-ready, not built yet)

CSV import/export with row-level validation; pool/knockout standings; data-quality
dashboard expansion; historical data migration (2008 onward); Supabase Realtime
multi-viewer scoreboards.
