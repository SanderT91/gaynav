# GAYNAV

Curated LGBTQ+ hotel search and booking. See [`CLAUDE.md`](CLAUDE.md) for the architecture principles and build plan.

## Requirements

- Node.js 24 (the version CI and Vercel use)
- npm
- Docker Desktop, for the local Supabase stack (on Windows it needs WSL 2)

## Scripts

| Command                     | What it does                                                  |
| --------------------------- | ------------------------------------------------------------- |
| `npm run dev`               | Start the dev server on http://localhost:3000                 |
| `npm run build`             | Production build                                              |
| `npm run lint`              | ESLint (Next.js + TypeScript rules)                           |
| `npm run typecheck`         | Generate route types and run `tsc`                            |
| `npm run format`            | Format all files with Prettier                                |
| `npm run format:check`      | Check formatting without writing                              |
| `npm test`                  | Unit tests (Vitest)                                           |
| `npm run test:watch`        | Unit tests in watch mode                                      |
| `npm run db:start`          | Start the local Supabase stack (needs Docker)                 |
| `npm run db:reset`          | Rebuild the local database from migrations                    |
| `npm run db:test`           | Rebuild the local database, then run the pgTAP tests          |
| `npm run db:check-exposure` | Check over HTTP that internal schemas are hidden from the API |
| `npm run db:stop`           | Stop the local Supabase stack                                 |

## Folder structure

```
src/
  app/        Next.js App Router — routes, layouts, pages
  lib/        Server-side helpers (Supabase clients, RateHawk client, …) — added as features need them
supabase/     Database migrations (migrations/), pgTAP tests (tests/database/), local config (config.toml)
scripts/      Small maintenance scripts (e.g. the API exposure check)
```

## Deployment

Hosted on Vercel (project `gaynav`, team `sander-swat`), connected to this GitHub repo.

- **Production:** every merge to `main` deploys to https://gaynav.vercel.app.
- **Previews:** every pull request gets its own preview deployment; the link appears on the PR. Previews are protected by Vercel Authentication — log in with an account on the Vercel team to view them.
- **Framework preset** is pinned to Next.js in [`vercel.json`](vercel.json) rather than in the dashboard, so the build setting lives in code and can't drift.
- **Environment variables** are set in the Vercel dashboard (Project → Settings → Environment Variables), never committed. Every name the app reads is listed in [`.env.example`](.env.example); a test fails CI if the two drift apart.

## Local development

You develop against a **local Supabase stack** running in Docker: a private, throwaway copy of the database and Auth, built from the migrations in this repo. Nothing you do locally touches the hosted project.

> **Why not a Supabase preview branch?** CLAUDE.md plans per-PR preview databases (Supabase Branching). That needs the Supabase Pro plan, which is deferred for the prototype (Epic 0.4). The local stack gives the same isolation on your own machine, and CI runs the same stack for every PR.

### First time

1. Install the requirements above, start Docker Desktop, then run `npm install`.
2. Run `npm run db:start`. The first run downloads the Supabase images (a few minutes), applies every migration and prints connection details.
3. Copy `.env.example` to `.env.local`. Fill in `NEXT_PUBLIC_SUPABASE_URL` with the printed `API_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with the printed `PUBLISHABLE_KEY`. These are fixed local demo values, not real credentials; `npx supabase status` shows them again later.
4. Run `npm run dev` and open http://localhost:3000.

### Every day

- `npm run db:start` / `npm run db:stop` start and stop the stack. Data survives a stop.
- `npm run db:reset` wipes the local database and rebuilds it from migrations. Do this after pulling new migrations.
- `npm test` runs the unit tests; `npm run db:test` runs the database tests (it resets the local database first).

### Signing up and testing as staff locally

1. Sign up at http://localhost:3000/login. Emails never leave your machine: open the local mail catcher at http://127.0.0.1:54324 and click the confirmation link there.
2. Make your local account staff (PowerShell or any terminal in the project folder):

   ```bash
   npx supabase db query "select * from admin.set_user_role('you@example.com', 'staff', 'local testing')"
   ```

3. Open http://localhost:3000/staff. You'll be asked to set up an authenticator app first.

### Changing the database

1. `npx supabase migration new <short_name>` creates a timestamped file in `supabase/migrations/`. Write the SQL there; never change a database by hand.
2. Add or update pgTAP tests in `supabase/tests/database/`, especially for anything touching RLS.
3. Run `npm run db:test`. CI runs the same tests on every PR.
4. The hosted project gets new migrations with `npx supabase db push`, only **after** the PR is merged, never from a feature branch.

## Branch protection (`main`)

Configured in GitHub (Settings → Branches), not in code:

- Changes reach `main` only through pull requests — no direct pushes, force-pushes or branch deletion.
- Both CI jobs (`Lint, typecheck, build` and `Database tests (RLS)`) must pass, on a branch that is up to date with `main`.
- The rules apply to admins too.
- **Phases 0–2:** no human approval required per PR (one review per phase, see `CLAUDE.md`). **From Phase 3:** raise "required approvals" to 1 before the first Phase 3 PR.
