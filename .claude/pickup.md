# Pickup — iofund-agent

**Last session:** 2026-05-18 (Opus 4.7).
**Status:** Task #1 ✓ done · Task #5 in_progress (chat scaffold landed; waiting on Vercel project + Neon provisioning before real UI work).

## Read in this order

1. `CLAUDE.md` — project orientation, conventions, constraints, decisions locked in
2. This file — concrete next actions + carryover threads
3. `data/io-fund-strategy.md` + `data/io-fund-thesis.md` — what IOF actually is and how they trade (load-bearing for any chat tool that reasons about positions or thesis)

> **Note:** the detailed Phase 0 plan that used to live at `thoughts/shared/plans/iofund-agent-poc.md` is now untracked (local-only on Hunter's machine). The task descriptions below are the durable record going forward.

## What's done

- **Task #1 — Repo + GH Actions foundation** ✓
  - Repo: `https://github.com/hunterphillips/iofund-agent` (private)
  - `.github/workflows/hello.yml` smoke workflow green: `https://github.com/hunterphillips/iofund-agent/actions/runs/26040340073`
  - GH secrets pushed: `IO_FUND_USERNAME`, `IO_FUND_PASSWORD`, `RESEND_API_KEY`, `AI_GATEWAY_API_KEY`
  - **Gotcha:** `gh secret set --env-file .env` is the robust way; `source .env` can silently drop values that contain shell metacharacters.
- **Task #5 — Chat scaffold (subtask)** ✓
  - `chat/` — Next.js 16 + React 19 + TypeScript, dark/gold placeholder page, local `pnpm build` + dev-server smoke test both green.
  - `evals/` — README sketch; `golden.jsonl` + `run_evals.py` land with first `/api/chat`.

## What's in flight (waiting on Hunter)

- **Vercel project setup.** Hunter is provisioning. Specifics: Root Directory = `chat`, env var `AI_GATEWAY_API_KEY` only (see "IOF creds in Vercel" below — they should NOT go in Vercel env). After first deploy: Storage tab → Connect Database → Neon (Marketplace) → auto-injects `DATABASE_URL`.

## Phase 0 task list (durable record)

| # | Task | Status | Blocked by |
|---|---|---|---|
| 1 | Repo + GH Actions foundation | ✓ done | — |
| 2 | Trade poll cron (Postgres ingest, fix notes-column bug, Resend notify on N>0 new trades) | pending | #1, Neon provisioned |
| 3 | Article discovery + ingest (Opus distill via AI Gateway → metadata to Postgres, body to `data/articles/*.md`) | pending | #1, Neon provisioned |
| 4 | Weekly digest + auto-PR for doc updates | pending | #2, #3 |
| 5 | Chat app (Next.js + AI SDK v6 + AI Gateway, Sonnet end-to-end, Drizzle ORM, IOF auth proxy) | in_progress | #1 |
| 6 | Portfolio gap analysis (CSV upload, replay Postgres trades → diff) | pending | #5, #2 |

## Decisions locked in (durable)

| Decision | Choice | Locked |
|---|---|---|
| LLM routing | Vercel AI Gateway with `"provider/model"` strings | 2026-05-18 |
| Per-task models | Opus distillation · Sonnet end-to-end for chat · Haiku deferred (no intent classifier in Phase 0) | 2026-05-18 |
| Storage — structured | Neon Postgres via Vercel Marketplace (trades, article metadata, eventually pgvector embeddings, eventually per-user RLS) | 2026-05-18 |
| Storage — prose | Git (strategy.md, thesis.md, distilled article bodies, digests) | 2026-05-18 |
| Chat app location | `chat/` subdir same repo | 2026-05-18 |
| ORM | Drizzle (Vercel-friendly, TypeScript-first) | 2026-05-18 |
| RAG / vector search | Deferred to Phase 1; `search_articles` is the swap-in seam | original |
| Durable workflows (Vercel Workflow DevKit) | Defer | original |

## IOF creds in Vercel — NO

The chat-app auth flow is "user types IOF email+password at sign-in; app passes them through to IOF Firebase to get a session JWT." So Vercel never needs `IO_FUND_USERNAME` / `IO_FUND_PASSWORD` as env vars even in Phase 0 — those are the deployer's personal creds, and the chat app is designed around per-user creds from day one.

- **Vercel env vars needed:** `AI_GATEWAY_API_KEY` (LLM calls), `DATABASE_URL` (auto-injected by Neon Marketplace), `RESEND_API_KEY` *only if* an email-send endpoint runs in Vercel (digest can run entirely from GH Actions where the secret already exists, so likely not needed in Vercel).
- **GH Actions secrets needed (already set):** `IO_FUND_USERNAME`, `IO_FUND_PASSWORD` (cron ingest only — these are Hunter's creds, used only to fetch his subscription content via cron), `AI_GATEWAY_API_KEY` (article distillation), `RESEND_API_KEY` (digest email).
- **After Neon provisioned, copy `DATABASE_URL` from Vercel to a GH secret** so cron ingest scripts can write rows.

This means the architecture is multi-tenant-clean from day one. Phase 3 multi-tenant doesn't need a creds-storage rewrite — it adds per-user `iof_credentials` table rows (encrypted with a Vercel-env-stored key), but the runtime "user types creds → call IOF Firebase" flow is the same.

## Open threads (defer)

| Thread | Status | Surface when |
|---|---|---|
| Prompt caching strategy (~10× cost win on chat) | Open | Start of Task #5 real API work |
| Branding / product name | Placeholder `iofund-agent`. Floated: IOF Companion / Compass / Brief | Before #5 polish pass |
| Multi-tenant refactor of `data/` (move prose to per-user repos or DB) | Schema is already Postgres so this is "add user_id + RLS" not a migration | Before pitching to IOF |

## What NOT to do

- **Don't reproduce IOF article prose verbatim** anywhere — in code, in docs, in chat output. The distilled docs in `data/` are transformative summaries; new article ingestion follows the same rule.
- **Don't deploy the chat app to a public URL** without Hunter's explicit go-ahead. Private Vercel URL + IOF auth for the POC; pitch to IOF before going wider.
- **Don't auto-commit changes to `data/io-fund-strategy.md` or `data/io-fund-thesis.md`** — the weekly digest workflow should auto-PR to a branch, not push to main. Hunter approves each PR manually. (Postgres-side writes from cron — new trade rows, article metadata — go straight to DB; no PR.)
- **Don't propose CSV-append patterns for new features** — structured rows go to Postgres now. Trade log CSV/JSON are historical artifacts only.
- **Don't try to re-implement what's already in `.claude/skills/iofund-fetch/`** — it works (with the notes-column bug; fix in #2).

## Known bugs

- `iofund-fetch` parses trades but **drops the notes column** in JSON output. Notes like `"3% trim"`, `"1% Add"`, `"Close"` carry the position-sizing signal — see §1 of `data/io-fund-strategy.md`. Fix during Task #2 when porting parser into `scripts/ingest_trades.py`.

## Library / API notes (read before affected tasks)

- **AI SDK v6 — loop control changed from v5.** `maxSteps: N` is deprecated. Use `stopWhen: stepCountIs(N)` on `streamText` / `generateText`, or `ToolLoopAgent` from `ai` for automatic loop management. Default cap is `stepCountIs(20)` so we explicitly cap lower. Confirmed against ai-sdk.dev/docs/agents/loop-control on 2026-05-18. Affects Task #5. Older blog posts will show the old `maxSteps` pattern — don't copy them.
- **Vercel + push-to-main triggers redeploy** (~30s–2min). Prose edits (digest, distilled article bodies) commit → Vercel rebuild → live system prompt updates. Structured-data writes (trades, article metadata rows) go to Postgres → no rebuild.
- **User-uploaded data (portfolio CSVs) is ephemeral.** Server-side session memory for the turn only — never written to `data/`, never persisted in Postgres in Phase 0. Affects Task #6.
- **pnpm 11 requires explicit build-script approval.** `chat/pnpm-workspace.yaml` has `allowBuilds: { sharp: true }` so Next image-opt builds correctly. Add new build-scripted deps the same way.

## Session-recovery checklist

If you're a fresh Claude Code session and the in-session task list is empty:

1. Read this file + `CLAUDE.md`
2. Re-create Phase 0 tasks via `TaskCreate` from the table above
3. Mark #1 completed; set #5 in_progress; set blocking relationships: #2,#3,#5 blocked by #1; #4 blocked by #2,#3; #6 blocked by #5,#2
4. Read project memory (`/Users/hunterphillips/.claude/projects/-Users-hunterphillips-workspace-work-investing-iofund/memory/MEMORY.md`) for durable architecture decisions
