# iofund-agent

A personal AI assistant for getting more value out of an [I/O Fund](https://io-fund.com) subscription — natural-language chat over IOF's published research, automatic ingestion of new trades and articles, and grounded answers cited back to the source.

> **Status:** private POC, Hunter-only. Long-term goal: pitch a polished member-facing version to the I/O Fund team.

## What it does today

- **Chat that knows IOF.** Ask "what's IOF's view on optical networking?" or "why did they close NVDA?" — the agent searches distilled summaries of IOF articles, looks up positions in the live trade log, and answers with citations linking back to the source article.
- **Auto-ingests trades.** A GitHub Actions cron polls IOF's `/premium/trades` page every 30 minutes on weekdays and upserts new trade alerts into Postgres. 1,250+ historical trades currently indexed. Each new trade also state-transitions a `positions` row (BUY → held, SELL+close → closed, trim → held), keeping a live snapshot of IOF's current book.
- **Auto-distills articles.** A daily cron polls IOF's RSS feed, fetches each new article behind the paywall, and produces a structured distillation (thesis · key numbers · takeaways · risks) via Claude Sonnet 4.6. ~$0.05/article. Stored in Postgres (full distilled body, FTS-indexed) and rendered live — no redeploy needed to publish.
- **Weekly auto-digest.** A Friday cron generates a 5-section summary of the past week's trades + articles via Sonnet 4.6, commits it to `data/digests/`, and runs a second LLM pass to detect whether the new activity supersedes anything in the running thesis doc — opening a PR against `thesis.md` when drift is found. Summary delivered via Resend.
- **Render-layer source attribution.** Every chat response shows a `Sources` block built deterministically from which articles the agent actually read — no hallucinated URLs possible.
- **Regression evals.** A small TypeScript harness runs natural-language queries against the chat code and asserts on tool-call traces, catching retrieval and citation regressions before they ship.

## Architecture sketch

```
┌─────────────────────────────────────────────────────────────────┐
│                      Hunter's IOF subscription                  │
│           (https://io-fund.com  — Firebase auth)                │
└────────────────────────────┬────────────────────────────────────┘
                             │  polls
                             ▼
       ┌──────────────────────────────────────────────────┐
       │   GitHub Actions crons (scripts/*.py)            │
       │   • poll-trades.yml       — */30 weekdays        │
       │   • discover-articles.yml — 0 14 * * *           │
       │   • weekly-digest.yml     — 0 21 * * 5           │
       └────────┬─────────────────────────────┬───────────┘
                │                             │
                ▼                             ▼
       ┌────────────────┐         ┌──────────────────────────┐
       │  Neon Postgres │◀────────│  AI Gateway (Sonnet 4.6) │
       │  • trades      │  body    │     distills article     │
       │  • articles    │         └──────────────────────────┘
       │    + body+FTS  │
       │  • positions   │
       │  • iof_creds   │
       └────────┬───────┘
                │
                ▼
       ┌──────────────────────────────────────────────────┐
       │   Next.js 16 chat app  (Vercel)                  │
       │   • Neon Auth (Google + email/password)          │
       │   • AI SDK v6 streamText + 5-step tool loop      │
       │   • Tools: read_doc · query_trades ·             │
       │            search_articles · read_article        │
       │   • Sources block from tool-call trace           │
       └──────────────────────────────────────────────────┘
                            ▲
                            │
                        Hunter (or future IOF subscribers)
```

**Storage is hybrid.** Postgres holds everything you query or render at runtime — trade history, article metadata + the full distilled article body (FTS-indexed), ticker arrays, encrypted credentials. Git holds only the prose a human versions and reviews (the strategy doc, the thesis doc, weekly digests). The chat reads articles and trades from Postgres; the strategy/thesis docs come from markdown on disk.

**Auth is two-layer.** Neon Auth handles the app identity (who's logged in). A separate `iof_credentials` table holds each user's AES-256-GCM-encrypted IOF email/password, keyed to their app user_id. The Phase 0 build is single-tenant (Hunter); Phase 2 layers Postgres RLS on top without changing the auth model.

## Quick start

```bash
# Clone, then:
cd chat
pnpm install
npx vercel link
npx vercel env pull .env.local --environment=production
pnpm dev
```

Open the URL the dev server prints, sign in via Neon Auth, connect your IOF account at `/onboarding/connect-iof`, and start chatting.

For the cron workflows to run, the GitHub repo needs `IO_FUND_USERNAME`, `IO_FUND_PASSWORD`, `DATABASE_URL`, and `AI_GATEWAY_API_KEY` as secrets.

## Roadmap

| Phase | Status | Scope |
|---|---|---|
| **0 — read-only intelligence + chat** | in progress | Trade poll ✓ · Article ingest ✓ · Chat ✓ · Weekly digest ✓ · Positions table ✓ · Portfolio gap analysis ☐ |
| **1 — RAG + broker read + email→webhook** | planned | pgvector hybrid with FTS · Alpaca paper read-only portfolio pull · IOF alert email → forwarder → webhook (replaces polling) |
| **2 — multi-tenant + pitch** | planned | Postgres RLS · public sign-up · billing · formal pitch to IOF team |

**Explicitly out of scope.** Write-side broker integration (auto-trade, semi-auto execution, approve-and-submit). Different liability/compliance posture; not IOF-pitchable. If pursued at all, it would be a separate app.

## Conventions

- **IOF article content is paid material.** Distillations are transformative summaries; the chat system prompt enforces no-verbatim-quoting. Source URLs are cited but the prose is paraphrased.
- **Trades source of truth is Postgres `public.trades`** — the CSV/JSON files in `data/` are historical seeds only.
- **Personal IOF credentials never go in Vercel env vars.** They live in GitHub Actions secrets (for crons that run as Hunter) and in encrypted Postgres rows (for end-user IOF subscriptions).
- **The `IOF_CREDS_ENCRYPTION_KEY` is unrotatable.** Rotating it requires a re-encrypt migration over every stored credential.

## Further reading

- [`CLAUDE.md`](./CLAUDE.md) — AI-agent orientation: file map, env contract, conventions. Read this if you're contributing or extending the codebase.
- [`WRITING.md`](./WRITING.md) — voice and style guide for all user-facing prose (strategy/thesis pages, digests, distilled summaries, chat, UI copy) and the LLM prompts that generate it. Read before editing any of those or their prompts.
- [`thoughts/shared/plans/`](./thoughts/shared/plans/) — design docs for each Phase 0 task. (Local-only; not checked in.)
- [`data/io-fund-strategy.md`](./data/io-fund-strategy.md) and [`data/io-fund-thesis.md`](./data/io-fund-thesis.md) — distilled framework docs the chat loads on demand.

## Credit

I/O Fund is run by Beth Kindig, Knox Ridley, Royston Roche, and the rest of their team. All article content, trade ideas, and framework material referenced by this assistant belongs to them. This project just helps a subscriber get more value out of an existing subscription — it doesn't redistribute paid content.
