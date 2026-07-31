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

## MCP service

The app serves a stateless Streamable HTTP MCP endpoint at `POST /api/mcp`.
Every request needs an API key in this exact header format:

```text
Authorization: Bearer iofiq_<secret>
```

The service exposes these read-only tools:

- `get_fund_book`: Current fund portfolio, category weights, statistics, and recent trades.
- `get_position`: Position details, trade history, related summaries, and recorded price move for one ticker.
- `query_trades`: Official trade-log rows with normalized move and sizing fields.
- `list_digests`: Available weekly digests, newest first.
- `get_digest`: One weekly digest by date, or the latest when no date is given.
- `read_doc`: The strategy or thesis reference for agent reasoning.
- `search_articles`: Search transformative article summaries by topic or ticker.
- `read_article`: Read one transformative article summary by URL.
- `analyze_portfolio_gap`: Compare explicit holdings or the synced Robinhood snapshot with the fund portfolio.
- `get_my_holdings`: Read the user's synced Robinhood ticker and share-count snapshot.
- `get_quotes`: Yahoo Finance prices, about 15 minutes delayed during market hours.

Tool failures return an error code and a message with the next action:

- `not_entitled`: The key's user needs to connect I/O Fund credentials at `/onboarding/connect-iof`.
- `broker_not_connected`: The key's user needs to connect Robinhood from the app's account menu.
- `upstream_unavailable`: A market-data or broker source is temporarily unavailable. Retry later.
- `not_found`: The requested position, digest, or article is not available.

Add the service to Claude Code with the deployment URL and the key printed by
the mint script:

```bash
claude mcp add --transport http iofund-iq <url>/api/mcp --header "Authorization: Bearer <key>"
```

Mint keys from `chat/`. The command prints the secret once and stores only its
SHA-256 hash:

```bash
pnpm tsx --env-file=.env.local scripts/mint-api-key.ts --user-id <id> --label <label>
```

Revoke a key by setting its `revoked_at` value. Labels are for operator lookup;
include the user id when labels may repeat:

```sql
UPDATE api_keys
SET revoked_at = now()
WHERE user_id = '<user-id>' AND label = '<label>' AND revoked_at IS NULL;
```
