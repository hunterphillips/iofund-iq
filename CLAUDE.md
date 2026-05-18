# iofund-agent

Personal AI assistant for getting more value out of an I/O Fund subscription. Long-term goal: a polished POC that can be pitched to the I/O Fund team as a member-facing product they could license or release to subscribers.

## Current state

Phase 0 build underway. Task #1 (repo + GH Actions foundation) is done; Task #5 (chat app) has a deploy-green scaffold and is in flight. See `.claude/pickup.md` for the durable task list and what to pick up next.

## Repository layout

| Path | Purpose |
|---|---|
| `chat/` | Next.js 16 App Router app. Chat UI, IOF auth proxy, `/api/chat` (Task #5). Deploys to Vercel with Root Directory = `chat`. |
| `evals/` | Lightweight regression harness for the chat app — `golden.jsonl` + `run_evals.py` + LLM-as-judge. PR gate on prompt/tool/model changes. |
| `scripts/` | Python ingest scripts (Task #2 trades poll, Task #3 article ingest, Task #4 weekly digest). Run from GH Actions. |
| `data/io-fund-strategy.md` | Alert decoding, sizing rules, hedging framework. Load-bearing for interpreting any IOF trade signal. |
| `data/io-fund-thesis.md` | Current IOF thesis state, per-ticker conviction history, theme evolution, decision-reasoning patterns. |
| `data/articles/` | Distilled article bodies (markdown). Metadata rows live in Postgres. |
| `data/digests/` | Weekly digest markdown archives. |
| `data/iofund-trades.csv` / `.json` | Historical trade log (~1,044 rows Jan 2021 – May 2026). Seed-imported into Postgres once; kept in git for provenance. **Trades source of truth going forward is Postgres.** |
| `data/io-fund-portfolio.pdf` | Historical snapshot — stale, reference only. |
| `.claude/skills/iofund-fetch/` | Python skill: authenticates against io-fund.com Firebase, fetches premium articles. |
| `.claude/pickup.md` | Where the next agent session should start. |
| `.github/workflows/` | GH Actions for cron ingest + hello smoke test. |
| `.env` | Local secrets (NOT committed). |

## Tech stack

- **Frontend / chat:** Next.js 16 App Router + AI SDK v6 + Vercel AI Gateway + Drizzle ORM
- **Backend / ingest:** GitHub Actions cron + Python scripts (using `iofund-fetch` skill)
- **Storage:** Hybrid — **Neon Postgres** for structured rows (trades, article metadata; eventually pgvector embeddings + per-user RLS) + **git** for prose (strategy.md, thesis.md, distilled article bodies, digests).
- **Email:** Resend (weekly digest, ingest notifications)
- **LLM routing:** Vercel AI Gateway with `"provider/model"` strings — Opus for distillation, Sonnet end-to-end for chat, Haiku deferred (no intent classifier in Phase 0)
- **Durable workflows (later):** Vercel Workflow DevKit if/when the digest pipeline outgrows GH Actions

## Conventions and guardrails

- **IOF subscription content is paid material.** Never reproduce article prose verbatim. The two distilled docs in `data/` are transformative summaries (frontmatter + structured tables, not copied prose). New article ingestion follows the same rule.
- **The trade log (Postgres) is the source of truth** for IOF positions, not the stale portfolio PDF. The CSV/JSON files in `data/` are the seed import only.
- **The distilled markdown docs in `data/` have frontmatter** (`load_priority`, `companion_docs`) and are optimized for agent consumption. Treat them as the project's knowledge backbone.
- **Hunter has an active IOF subscription.** Cron ingest uses his credentials (`IO_FUND_USERNAME` / `IO_FUND_PASSWORD` in GH Actions secrets) to fetch his subscription content. The chat app, by contrast, expects each user to type their own IOF creds at sign-in — those creds are never stored in env vars.
- **Durable session state lives in `.claude/pickup.md`** (not at repo root). The `/pickup` skill writes there.

## End-goal product (Phase 0+ target)

Three hero features, all demo-ready:

1. **Natural-language chat** over the user's IOF subscription content
2. **Weekly auto-digest** of new IOF activity (email + in-app archive), with auto-PR proposing updates to the distilled docs when content drift is detected
3. **Personal portfolio gap analysis** (CSV upload → diff vs IOF current book, with conviction context)

Architecture is designed for single-user POC but **multi-tenant-clean from day one** — per-user auth and per-user data scoping via Postgres RLS, so the eventual shareable version is not a rewrite.

## Phases

- **Phase 0** (current): read-only intelligence + chat app
- **Phase 1**: live broker integration (Alpaca paper → live), real-time portfolio sync, pgvector RAG (Neon already provisioned in Phase 0 — RAG becomes "add column" not "add infra")
- **Phase 2**: semi-auto execution (one-tap approve → broker)
- **Phase 3**: multi-tenant refactor (per-user `iof_credentials` table + Postgres RLS, no architecture rewrite) + formal pitch to IOF team

## Orientation for new sessions

1. This file (you're here)
2. `.claude/pickup.md` — concrete next actions, durable task list, locked-in decisions
3. `data/io-fund-strategy.md` + `data/io-fund-thesis.md` — what IOF actually is and how they trade

## Important constraints

- Do **not** auto-commit changes to the distilled docs (`data/io-fund-strategy.md`, `data/io-fund-thesis.md`) without Hunter's approval. The weekly digest workflow should auto-PR to a branch.
- Do **not** deploy the chat app to a public URL without explicit go-ahead. Calling IOF's Firebase from a third-party server is fine for a POC shown TO IOF, but a public deploy without their blessing is bad IP posture.
- Do **not** put `IO_FUND_USERNAME` / `IO_FUND_PASSWORD` in Vercel env vars. The chat app gets IOF creds from the user at sign-in. Cron jobs that use Hunter's creds run in GH Actions, where the secrets already live.
- Do **not** propose CSV-append patterns for new structured data — that goes to Postgres. Prose still goes to git.
