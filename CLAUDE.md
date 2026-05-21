# iofund-agent

Personal AI assistant for getting more value out of an I/O Fund subscription. Long-term goal: a polished POC pitchable to the I/O Fund team as a member-facing product.

## Stack

- **App:** Next.js 16 App Router · React 19 · TypeScript · pnpm
- **Auth:** Neon Auth (powered by Better Auth) — Google OAuth + email/password
- **DB:** Neon Postgres via Vercel Marketplace · Drizzle ORM · `@neondatabase/serverless`
- **LLM:** Vercel AI Gateway — `"anthropic/claude-sonnet-4-6"` for both chat and article distillation. AI SDK v6 (`streamText` + `stepCountIs(5)`).
- **Storage:** Hybrid — Postgres for structured rows (trades, article metadata + FTS body, encrypted IOF credentials); git for prose (strategy/thesis docs, distilled article bodies, future digests).
- **Search:** Postgres `tsvector` full-text search on `articles(title, body)` with GIN index; pgvector RAG deferred to Phase 1.
- **Cron:** GitHub Actions + Python `scripts/` for trade poll (#2), article ingest (#3), weekly digest (#4). Resend live (`onboarding@resend.dev` → Hunter's email) — the only outbound email from the system.

## Structure

- `chat/` — Next.js app.
  - `app/` — App Router pages (`/`, `/auth/[path]`, `/onboarding/connect-iof`) + API routes (`/api/auth/[...path]`, `/api/chat`, `/api/onboarding/connect-iof`).
  - `db/` — Drizzle `schema.ts`, `migrations/`, Neon HTTP client (`index.ts`), AES-256-GCM encryption helper (`encryption.ts`).
  - `lib/auth/` — Neon Auth server + client config.
  - `lib/iof/` — IOF Firebase verifier (`firebase.ts`) + encrypted credentials read/write (`credentials.ts`).
  - `lib/chat/` — Chat system prompt, AI SDK tools, prose-doc readers.
  - `components/chat-thread.tsx` — `useChat` hook + message thread with transient tool-call indicators + react-markdown rendering + deterministic Sources block built from the `read_article` tool-call trace.
  - `evals/` — TypeScript regression harness (`run.ts`, `cases.ts`). Imports `chatTools` + `SYSTEM_PROMPT` directly, runs `generateText`, asserts on tool-call trace + response text. Runs via `pnpm eval`.
  - `scripts/seed-trades.ts` — one-shot CSV → Postgres seeder.
  - `scripts/copy-data.sh` — predev/prebuild + preeval step copying repo-root `data/*.md` → `chat/_data/` (Turbopack rejects parent-dir globs in `outputFileTracingIncludes`).
  - `_data/` — materialized at build time from repo-root `data/` (gitignored).
- `data/` — Knowledge corpus, canonical source.
  - `io-fund-strategy.md` — alert decoding, sizing rules, hedging framework. Load-bearing for the chat system prompt.
  - `io-fund-thesis.md` — per-ticker conviction history, theme evolution, decision-reasoning patterns.
  - `articles/*.md` — distilled IOF articles, written by the daily cron with YAML frontmatter + structured sections. Body searchable via Postgres FTS; rendered Sources via tool-call trace.
  - `iofund-trades.csv` / `.json` — historical IOF trade log (seed-imported once; **source of truth going forward is `public.trades`**).
  - `io-fund-portfolio-pie.pdf` — categorized current holdings + weight%, snapshot 2026-05-19. **Bootstrap source for the planned `positions` table (Task #4.5).**
  - `io-fund-portfolio-history.pdf` — per-tranche entry history for currently-held positions (cost basis + entry date per tranche).
  - `io-fund-portfolio.pdf` — older snapshot, reference only.
  - `digests/*.md` — written weekly by `scripts/digest_week.py` (Task #4); each file is a structured 5-section summary of that week's trades + articles.
- `scripts/` — Python cron entrypoints.
  - `ingest_trades.py` — RSS-less trade poll via Firebase + `__NEXT_DATA__` parser; upserts `public.trades` keyed by `iof:<server-id>`.
  - `ingest_articles.py` — daily RSS poll → diff vs `articles` table → Firebase-auth fetch → Sonnet 4.6 distillation via AI Gateway → write row + `data/articles/*.md`. Idempotent. `INGEST_BACKFILL_BODY=1` for one-shot body backfill.
  - `digest_week.py` — weekly digest. Reads past-7d trades + articles; generates 5-section digest via Sonnet 4.6; commits to `data/digests/`; runs a second LLM call to detect drift in `thesis.md` and opens a PR if found; emails summary via Resend. Owns the full pipeline (DB → LLM → git → PR → email) so the workflow stays thin. `DIGEST_DRY_RUN=1`, `DIGEST_FORCE_OVERWRITE=1`, `DIGEST_SKIP_PR=1`, `DIGEST_SKIP_EMAIL=1` for granular local testing.
- `.github/workflows/` — `poll-trades.yml` (cron */30 weekdays), `discover-articles.yml` (cron 14:00 UTC daily, commits to main), `weekly-digest.yml` (cron `0 21 * * 5` Friday 5pm ET, opens PRs against thesis.md if drift detected), `hello.yml` (secrets smoke test).

## Development

### Setup

```bash
cd chat
pnpm install
npx vercel link                              # one-time: links chat/ to the iofund-agent Vercel project
npx vercel env pull .env.local --environment=production
```

Required env vars in `chat/.env.local`: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `IOF_CREDS_ENCRYPTION_KEY`, `AI_GATEWAY_API_KEY`. Neon Marketplace auto-injects the `DATABASE_*` vars; the others were added manually to the Vercel project.

### Running

```bash
cd chat && pnpm dev
```

predev copies `data/*.md` → `chat/_data/` so chat tools can read them. Hits port 3000 or next free.

### DB schema changes

```bash
cd chat
pnpm db:generate                              # diff db/schema.ts → new migration SQL
pnpm db:migrate                               # apply to Neon
```

`tsvector` generated columns and GIN indexes are hand-extensions to the Drizzle-generated migration (Drizzle's schema snapshot doesn't track them, which is fine — Postgres manages the generated column).

### Verification

- `cd chat && pnpm build` — type-check + production build.
- `cd chat && pnpm eval` — eval suite against the chat agent. Asserts on tool-call traces, not free-form prose. Preeval runs copy-data.sh.
- For UI changes, hit dev server in a browser. Type-check passes but doesn't catch rendering issues.

## Conventions and guardrails

- **IOF subscription content is paid material.** Never reproduce article prose verbatim in code, docs, or chat output. The distilled docs in `data/` are transformative summaries; new article ingestion follows the same rule (system prompt enforces this for the chat agent).
- **Trades source of truth is Postgres (`public.trades`)**, not the seed CSV/JSON files in `data/`.
- **Two-layer auth:** Neon Auth identifies the app user; `public.iof_credentials` stores their AES-encrypted IOF email+password keyed to `neon_auth.user.id`. **Never put `IO_FUND_USERNAME`/`IO_FUND_PASSWORD` in Vercel env vars.** They live only in GH Actions secrets (for cron jobs that run as Hunter) and in encrypted DB rows (for end-user IOF subscriptions).
- **`IOF_CREDS_ENCRYPTION_KEY` is unrotatable** — losing or changing it bricks every stored IOF credential. Rotation requires a re-encrypt migration.
- **Citations are render-layer, not prompt-driven.** The Sources block in `chat-thread.tsx` is built deterministically from the `read_article` tool-call trace. The model writes free-form prose; the renderer guarantees attribution. Don't add citation rules to the system prompt.
- **Don't auto-commit changes to `data/io-fund-strategy.md` or `data/io-fund-thesis.md`.** Weekly digest workflow (Task #4) opens an auto-PR to a branch; Hunter approves manually. `data/articles/*.md` from the daily cron are committed directly to main — they're auto-generated distillations, not curated docs.
- **Don't deploy publicly without IOF's blessing.** Private Vercel URL only until the pitch lands.

## End-goal product

Three hero features (Phase 0 target):

1. **Natural-language chat** over IOF subscription content (live as of 2026-05-19; FTS retrieval + render-layer sources as of 2026-05-20).
2. **Weekly auto-digest** of new IOF activity (live as of 2026-05-20; opens auto-PRs against `thesis.md` when drift detected).
3. **Personal portfolio gap analysis** (CSV upload → diff vs IOF current book) (Task #6 — pending; blocked by Task #4.5).

Architecture is **multi-tenant-clean from day one** — every per-user table keyed by `user_id`. Phase 3 multi-tenant rollout adds Postgres RLS policies, not an auth/data-model rewrite.

## Phases

- **Phase 0** (current): read-only intelligence + chat app. Tasks #1, #2, #3, #4, #5 ✓ done · Task #4.5 (positions table) + Task #6 pending.
- **Phase 1**: pgvector RAG on existing Neon Postgres (`ALTER TABLE` not new infra) once distilled-article corpus warrants semantic search — hybrid with existing FTS. **Email→webhook trade ingest** to replace polling (IOF sends per-trade emails already; forward → Resend Inbound or Apps Script → our webhook → immediate Postgres insert) — same data flow as Task #2, lower latency. **Read-only broker portfolio sync** (Alpaca paper first) as the upgrade path to Task #6's CSV-upload flow — same diff/conviction-context tool, automatic data source.
- **Phase 2**: multi-tenant rollout (RLS policies + per-user `iof_credentials` already in schema + public sign-up + billing) + formal pitch to I/O Fund team.

> **Write-side broker integration is out of scope** — no auto-trade, no semi-auto execution, no approve-and-submit-to-broker flows. Different liability/compliance/brand-association posture; not IOF-pitchable. If pursued at all later, it would be a separate app. **Read-side broker integration (portfolio pull) IS in scope** as the Phase 1 upgrade to Task #6 — the chat needs to compare the user's actual holdings against IOF's current book; CSV upload is the Phase 0 stand-in.
