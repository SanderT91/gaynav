# GAYNAV

Curated LGBTQ+ hotel search and booking. See [`CLAUDE.md`](CLAUDE.md) for the architecture principles and build plan.

## Requirements

- Node.js 20.9 or newer (developed on Node 24)
- npm

## Scripts

| Command                | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Start the dev server on http://localhost:3000 |
| `npm run build`        | Production build                              |
| `npm run lint`         | ESLint (Next.js + TypeScript rules)           |
| `npm run typecheck`    | Generate route types and run `tsc`            |
| `npm run format`       | Format all files with Prettier                |
| `npm run format:check` | Check formatting without writing              |
| `npm run db:start`     | Start the local Supabase stack (needs Docker) |
| `npm run db:reset`     | Rebuild the local database from migrations    |
| `npm run db:test`      | Run the database (pgTAP) tests                |
| `npm run db:stop`      | Stop the local Supabase stack                 |

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
- **Environment variables** are set in the Vercel dashboard (Project → Settings → Environment Variables), never committed. The list of required names will live in `.env.example` (Epic 0.5).
