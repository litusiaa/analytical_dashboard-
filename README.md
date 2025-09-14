# Analytical Dashboard (PM MVP)

Next.js 14 (App Router, TypeScript, RSC) BI dashboard. This MVP implements the PM section with metrics sourced from Pipedrive v1 and a 30-minute auto-sync via Vercel Cron.

## Deploy (Vercel)
- Create a new Vercel project and link this repo.
- Set ENV variables in Vercel project settings (see ENV section below).
- Vercel will detect Next.js and deploy.

## ENV (set in Vercel)
- `PIPEDRIVE_API_TOKEN` — Pipedrive API token
- `PIPEDRIVE_BASE_URL` — default `https://api.pipedrive.com/v1`
- `SYNC_SECRET` — sync authorization secret
- `DATABASE_URL` — Postgres connection URL
- `APP_TIMEZONE` — default `Europe/Moscow`

## Sync & Cron
- Health: `GET /api/health`
- Manual sync: `POST /api/sync/pipedrive?mode=full` with `Authorization: Bearer <SYNC_SECRET>` (or `?secret=...` fallback)
- Cron: configured in `vercel.json` to run every 30 minutes hitting `mode=inc`.

## GitHub Actions
Workflow `.github/workflows/db-migrate.yml` runs Prisma generate and `db push` on schema changes.

## Local development
Optional: `npm install` then `npm run dev`. All secrets should be provided via `.env.local` for local runs. Do not commit secrets.
