# chat — iofund-agent Next.js app

Phase 0 scaffold. The chat UI, IOF auth proxy, and `/api/chat` AI SDK route
all live here. See `thoughts/shared/plans/iofund-agent-poc.md` Task #5 for the
full design.

## Local dev

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Deploy

Auto-deploys on push to `main` via Vercel. The Vercel project is configured
with **Root Directory = `chat`**, so commits that only touch `data/`,
`scripts/`, `.github/`, etc. will not trigger this app's rebuild.

## Env vars (needed in `chat/.env.local` for local dev, and in Vercel project
env for production):

| Var | Source | Used for |
|---|---|---|
| `AI_GATEWAY_API_KEY` | repo `.env` | AI SDK calls via Vercel AI Gateway |
| `DATABASE_URL` | Neon (auto-injected by Vercel Marketplace) | Postgres for trades + article metadata |
| `IO_FUND_USERNAME` / `IO_FUND_PASSWORD` | repo `.env` | IOF Firebase auth proxy (Task #5) |
| `RESEND_API_KEY` | repo `.env` | Email notifications (Task #4) |
