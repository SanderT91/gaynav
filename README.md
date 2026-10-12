# GAYNAV

Curated LGBTQ+ hotel search and booking. See [`CLAUDE.md`](CLAUDE.md) for the architecture principles and build plan.

## Requirements

- Node.js 20.9 or newer (developed on Node 24)
- npm

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
supabase/     Database migrations and RLS tests — added in Epic 0.2
```

A full local-development guide (Supabase, environment variables) follows in Epic 0.5.

## Deployment

Hosted on Vercel (project `gaynav`, team `sander-swat`), connected to this GitHub repo.

- **Production:** every merge to `main` deploys to https://gaynav.vercel.app.
- **Previews:** every pull request gets its own preview deployment; the link appears on the PR. Previews are protected by Vercel Authentication — log in with an account on the Vercel team to view them.
- **Framework preset** is pinned to Next.js in [`vercel.json`](vercel.json) rather than in the dashboard, so the build setting lives in code and can't drift.
- **Environment variables** are set in the Vercel dashboard (Project → Settings → Environment Variables), never committed. Every name the app reads is listed in [`.env.example`](.env.example); a test fails CI if the two drift apart.

## Authentication (local)

Sign-up, sign-in and sessions use Supabase Auth (`src/lib/supabase/`, `src/proxy.ts`). Locally:

1. `npm run db:start` (needs Docker) — prints the local `API_URL` and `PUBLISHABLE_KEY`.
2. Copy `.env.example` to `.env.local` and fill in those two values.
3. `npm run dev`, then open http://localhost:3000/login.
4. Confirmation emails don't leave your machine: open the local mail catcher at http://127.0.0.1:54324 and click the link there.

## Branch protection (`main`)

Configured in GitHub (Settings → Branches), not in code:

- Changes reach `main` only through pull requests — no direct pushes, force-pushes or branch deletion.
- Both CI jobs (`Lint, typecheck, build` and `Database tests (RLS)`) must pass, on a branch that is up to date with `main`.
- The rules apply to admins too.
- **Phases 0–2:** no human approval required per PR (one review per phase, see `CLAUDE.md`). **From Phase 3:** raise "required approvals" to 1 before the first Phase 3 PR.
