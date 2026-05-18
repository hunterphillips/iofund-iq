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
- **Task #5 — DB foundation (subtask)** ✓
  - Neon Postgres provisioned via Vercel Marketplace; Neon Auth (Better Auth) enabled with Google OAuth + email/password.
  - Drizzle ORM wired: `chat/db/schema.ts` (iof_credentials, trades, articles), `chat/db/index.ts` (Neon HTTP client), `chat/db/encryption.ts` (AES-256-GCM with `IOF_CREDS_ENCRYPTION_KEY`, tamper-detection verified), `chat/drizzle.config.ts` (schemaFilter: ["public"] excludes Neon Auth tables).
  - First migration `0000_pink_shinko_yamashiro.sql` applied to Neon. All 3 public tables + 9 `neon_auth.*` tables live.
  - Vercel env vars confirmed live: `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `IOF_CREDS_ENCRYPTION_KEY`, `DATABASE_URL` (+ 15 other `DATABASE_*` from Neon Marketplace, prod+preview scoped only).

## What's next (next chunk of Task #5)

**Wire `@neondatabase/auth` SDK into the chat app.** Install package, add `lib/auth/server.ts` (`createNeonAuth` using `NEON_AUTH_BASE_URL` + `NEON_AUTH_COOKIE_SECRET`), add catch-all auth API route, build minimal signup + signin pages (or use Neon's UI components). Use Google OAuth as primary CTA. After signup works, add the "Connect IOF account" onboarding step that uses `chat/db/encryption.ts` to write to `iof_credentials`.

**Then:** Vercel deploy (first real green deploy beyond the placeholder), and verify the IOF Firebase auth exchange round-trip works server-side.

## Phase 0 task list (durable record)

| # | Task | Status | Blocked by |
|---|---|---|---|
| 1 | Repo + GH Actions foundation | ✓ done | — |
| 2 | Trade poll cron (Postgres ingest, fix notes-column bug, Resend notify on N>0 new trades) | pending | #1, Neon provisioned |
| 3 | Article discovery + ingest (Opus distill via AI Gateway → metadata to Postgres, body to `data/articles/*.md`) | pending | #1, Neon provisioned |
| 4 | Weekly digest + auto-PR for doc updates | pending | #2, #3 |
| 5 | Chat app (Next.js + AI SDK v6 + AI Gateway, Sonnet end-to-end, Drizzle ORM, Neon Auth + encrypted IOF creds) | in_progress | #1 |
| 6 | Portfolio gap analysis (CSV upload, replay Postgres trades → diff) | pending | #5, #2 |

## Decisions locked in (durable)

| Decision | Choice | Locked |
|---|---|---|
| LLM routing | Vercel AI Gateway with `"provider/model"` strings | 2026-05-18 |
| Per-task models | Opus distillation · Sonnet end-to-end for chat · Haiku deferred (no intent classifier in Phase 0) | 2026-05-18 |
| Storage — structured | Neon Postgres via Vercel Marketplace (trades, article metadata, eventually pgvector embeddings, eventually per-user RLS) | 2026-05-18 |
| Storage — prose | Git (strategy.md, thesis.md, distilled article bodies, digests) | 2026-05-18 |
| Auth | Two-layer: Neon Auth (app) + encrypted `iof_credentials` table (integration). Standard SaaS pattern. Multi-tenant from day one. | 2026-05-18 |
| Chat app location | `chat/` subdir same repo | 2026-05-18 |
| ORM | Drizzle (Vercel-friendly, TypeScript-first) | 2026-05-18 |
| RAG / vector search | Deferred to Phase 1; `search_articles` is the swap-in seam | original |
| Durable workflows (Vercel Workflow DevKit) | Defer | original |

## Auth architecture — two-layer (revised 2026-05-18 with Neon Auth)

Original Task #5 design had one auth layer ("user types IOF creds → app proxies to IOF Firebase"). Replaced with the standard SaaS two-layer pattern when Neon Auth was enabled during Marketplace provisioning:

| Layer | What | Where |
|---|---|---|
| **App account** | "Who is this user of our app" | Neon Auth (**Better Auth** — Stack Auth is the deprecated/legacy path as of Jan 2026). Creates `neon_auth.user` (canonical user — singular, NOT `users_sync`) plus 8 other tables in the `neon_auth` schema. |
| **IOF account** | "What IOF subscription do they own" | `public.iof_credentials(user_id PK, encrypted_email bytea, encrypted_password bytea, last_verified_at)` — keyed to Neon Auth user_id, AES-256-GCM encrypted with `IOF_CREDS_ENCRYPTION_KEY`. FK to `neon_auth.user(id)` enforced at app layer for now; deferred raw migration once SDK wiring confirms id column type. |

**Auth flow:**
1. User signs up via Neon Auth (recommend Google OAuth as primary; email+password as fallback)
2. First-run onboarding prompts "Connect your IOF subscription"
3. User enters IOF creds once → app exchanges for Firebase JWT to verify → AES-encrypts with `IOF_CREDS_ENCRYPTION_KEY` → stores in `iof_credentials`
4. Subsequent sessions: Neon Auth identifies user → backend decrypts stored IOF creds → exchanges for fresh Firebase JWT per request (or short cache) → `/api/chat` uses that JWT for IOF Firebase calls

**Vercel env vars (confirmed live as of 2026-05-18):**
- `AI_GATEWAY_API_KEY` — LLM calls
- `DATABASE_URL` + 15 other `DATABASE_*` vars — auto-injected by Neon Marketplace, **scoped Production+Preview only.** For local dev: `vercel env pull .env.local --environment=production` picks them up.
- `NEON_AUTH_BASE_URL` — manually added. Value is the Auth URL from the Neon console (`https://ep-quiet-wind-aqdcewde.neonauth.c-8.us-east-1.aws.neon.tech/neondb/auth`).
- `NEON_AUTH_COOKIE_SECRET` — manually added, `openssl rand -base64 32`.
- `IOF_CREDS_ENCRYPTION_KEY` — manually added, `openssl rand -base64 32` (different value than cookie secret). **NEVER rotate without a re-encrypt migration.**
- `DATABASE_VITE_NEON_AUTH_URL` — auto-injected by Neon Auth, Vite naming — unused; Next.js code reads `NEON_AUTH_BASE_URL` instead.

**GH Actions secrets (already set):** `IO_FUND_USERNAME`, `IO_FUND_PASSWORD` (cron ingest only — Hunter's creds for his own subscription), `AI_GATEWAY_API_KEY`, `RESEND_API_KEY`. **TODO:** mirror `DATABASE_URL` from Vercel into a GH secret so cron ingest can write — one-liner once we start Task #2.

**Why two-layer:**
- Multi-tenant from day one becomes literal — every app table keyed by `user_id`, RLS is just a policy add in Phase 3
- Standard SaaS pattern (Stripe, Linear, anything with integrations) — credible demo posture vs "type your IOF password here"
- IOF creds at rest are encrypted, not in cookies, not in env vars
- Phase 3 multi-tenant rollout is a feature-add (signup page + billing), not an auth rewrite

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
- **Neon Auth uses Stack Auth under the hood.** Use the official Neon Auth Next.js SDK (search "neon auth nextjs" — package likely `@stackframe/stack` or `@neon/auth`, confirm at integration time). The `neon_auth.users_sync` table is auto-maintained by Neon — declare it in Drizzle schema as read-only / reference only. Never INSERT/UPDATE it directly.

## Session-recovery checklist

If you're a fresh Claude Code session and the in-session task list is empty:

1. Read this file + `CLAUDE.md`
2. Re-create Phase 0 tasks via `TaskCreate` from the table above
3. Mark #1 completed; set #5 in_progress; set blocking relationships: #2,#3,#5 blocked by #1; #4 blocked by #2,#3; #6 blocked by #5,#2
4. Read project memory (`/Users/hunterphillips/.claude/projects/-Users-hunterphillips-workspace-work-investing-iofund/memory/MEMORY.md`) for durable architecture decisions
