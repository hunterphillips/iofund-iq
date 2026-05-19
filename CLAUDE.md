# iofund-agent

Personal AI assistant for getting more value out of an I/O Fund subscription. Long-term goal: a polished POC pitchable to the I/O Fund team as a member-facing product.

## Stack

- **App:** Next.js 16 App Router · React 19 · TypeScript · pnpm
- **Auth:** Neon Auth (powered by Better Auth) — Google OAuth + email/password
- **DB:** Neon Postgres via Vercel Marketplace · Drizzle ORM · `@neondatabase/serverless`
- **LLM:** Vercel AI Gateway routes `"anthropic/claude-sonnet-4-6"` for chat (Opus reserved for future distillation). AI SDK v6 (`streamText` + `stepCountIs(5)`).
- **Storage:** Hybrid — Postgres for structured rows (trades, article metadata, encrypted IOF credentials); git for prose (strategy/thesis docs, distilled article bodies, digests).
- **Email (planned):** Resend, for Tasks #2/#4.
- **Cron (planned):** GitHub Actions + Python `scripts/` for Tasks #2-#4 (not yet built).

## Structure

- `chat/` — Next.js app.
  - `app/` — App Router pages (`/`, `/auth/[path]`, `/onboarding/connect-iof`) + API routes (`/api/auth/[...path]`, `/api/chat`, `/api/onboarding/connect-iof`).
  - `db/` — Drizzle `schema.ts`, `migrations/`, Neon HTTP client (`index.ts`), AES-256-GCM encryption helper (`encryption.ts`).
  - `lib/auth/` — Neon Auth server + client config.
  - `lib/iof/` — IOF Firebase verifier (`firebase.ts`) + encrypted credentials read/write (`credentials.ts`).
  - `lib/chat/` — Chat system prompt, AI SDK tools, prose-doc readers.
  - `components/chat-thread.tsx` — `useChat` hook + message thread with transient tool-call indicators + react-markdown rendering.
  - `scripts/seed-trades.ts` — one-shot CSV → Postgres seeder.
  - `scripts/copy-data.sh` — predev/prebuild step copying repo-root `data/*.md` → `chat/_data/` (Turbopack rejects parent-dir globs in `outputFileTracingIncludes`).
  - `_data/` — materialized at build time from repo-root `data/` (gitignored).
- `data/` — Knowledge corpus, canonical source.
  - `io-fund-strategy.md` — alert decoding, sizing rules, hedging framework. Load-bearing for the chat system prompt.
  - `io-fund-thesis.md` — per-ticker conviction history, theme evolution, decision-reasoning patterns.
  - `iofund-trades.csv` / `.json` — historical IOF trade log. Seed-imported once into Postgres; **source of truth going forward is `public.trades`**.
  - `io-fund-portfolio.pdf` — stale snapshot, reference only.
  - `articles/`, `digests/` — populated by future ingest cron (Tasks #3, #4).
- `evals/` — Regression harness for chat behavior (README sketch; landing alongside the first regression-eligible change).
- `.github/workflows/hello.yml` — secrets smoke test. Cron workflows land with Tasks #2-#4.

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

### Verification

- `cd chat && pnpm build` — type-check + production build.
- For UI changes, hit dev server in a browser. Type-check passes but doesn't catch rendering issues.

## Conventions and guardrails

- **IOF subscription content is paid material.** Never reproduce article prose verbatim in code, docs, or chat output. The distilled docs in `data/` are transformative summaries; new article ingestion follows the same rule (system prompt enforces this for the chat agent).
- **Trades source of truth is Postgres (`public.trades`)**, not the seed CSV/JSON files in `data/`.
- **Two-layer auth:** Neon Auth identifies the app user; `public.iof_credentials` stores their AES-encrypted IOF email+password keyed to `neon_auth.user.id`. **Never put `IO_FUND_USERNAME`/`IO_FUND_PASSWORD` in Vercel env vars.** They live only in GH Actions secrets (for cron jobs that run as Hunter) and in encrypted DB rows (for end-user IOF subscriptions).
- **`IOF_CREDS_ENCRYPTION_KEY` is unrotatable** — losing or changing it bricks every stored IOF credential. Rotation requires a re-encrypt migration.
- **Don't auto-commit changes to `data/io-fund-strategy.md` or `data/io-fund-thesis.md`.** Weekly digest workflow (Task #4) opens an auto-PR to a branch; Hunter approves manually.
- **Don't deploy publicly without IOF's blessing.** Private Vercel URL only until the pitch lands.

## End-goal product

Three hero features (Phase 0 target):

1. **Natural-language chat** over IOF subscription content (functional locally as of 2026-05-18).
2. **Weekly auto-digest** of new IOF activity (Task #4).
3. **Personal portfolio gap analysis** (CSV upload → diff vs IOF current book) (Task #6).

Architecture is **multi-tenant-clean from day one** — every per-user table keyed by `user_id`. Phase 3 multi-tenant rollout adds Postgres RLS policies, not an auth/data-model rewrite.

## Phases

- **Phase 0** (current): read-only intelligence + chat app. Tasks #1, #2, #5 ✓ done · Tasks #3, #4, #6 pending.
- **Phase 1**: pgvector RAG on existing Neon Postgres (`ALTER TABLE` not new infra) once distilled-article corpus crosses ~30 articles. **Email→webhook trade ingest** to replace polling (IOF sends per-trade emails already; forward → Resend Inbound or Apps Script → our webhook → immediate Postgres insert) — same data flow as Task #2, lower latency. **Read-only broker portfolio sync** (Alpaca paper first) as the upgrade path to Task #6's CSV-upload flow — same diff/conviction-context tool, automatic data source.
- **Phase 2**: multi-tenant rollout (RLS policies + per-user `iof_credentials` already in schema + public sign-up + billing) + formal pitch to I/O Fund team.

> **Write-side broker integration is out of scope** — no auto-trade, no semi-auto execution, no approve-and-submit-to-broker flows. Different liability/compliance/brand-association posture; not IOF-pitchable. If pursued at all later, it would be a separate app. **Read-side broker integration (portfolio pull) IS in scope** as the Phase 1 upgrade to Task #6 — the chat needs to compare the user's actual holdings against IOF's current book; CSV upload is the Phase 0 stand-in.
