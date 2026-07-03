# chat — iofund-iq Next.js app

The chat UI, authenticated app surfaces (`/fund`, `/articles`, `/portfolio`,
`/positions/[ticker]`), and all `/api/*` routes live here. See the repo-root
`CLAUDE.md` for the full architecture, env contract, and conventions.

## Local dev

```bash
pnpm install
npx vercel link                              # one-time
npx vercel env pull .env.local --environment=production
pnpm dev
```

## Deploy

Auto-deploys on push to `main` via Vercel. The Vercel project is configured
with **Root Directory = `chat`**, so commits that only touch `data/`,
`scripts/`, `.github/`, etc. will not trigger this app's rebuild.

## Env vars

Required in `chat/.env.local` (and the Vercel project env): `DATABASE_URL`,
`NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `IOF_CREDS_ENCRYPTION_KEY`,
`AI_GATEWAY_API_KEY`, `ROBINHOOD_CLIENT_ID`, `ROBINHOOD_TOKEN_ENCRYPTION_KEY`.
`vercel env pull` fetches them all; details in root `CLAUDE.md`.

Operator IOF credentials (`IO_FUND_USERNAME`/`IO_FUND_PASSWORD`) and
`RESEND_API_KEY` belong to the Python crons — GitHub Actions secrets only,
**never** this app's env.
