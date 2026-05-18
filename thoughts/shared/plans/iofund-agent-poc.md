---
title: iofund-agent — Phase 0 POC
status: planning
created: 2026-05-18
authors: Hunter Phillips, Claude (Opus 4.7)
companion_docs:
  - ../../../CLAUDE.md
  - ../../../pickup.md
  - ../../../data/io-fund-strategy.md
  - ../../../data/io-fund-thesis.md
---

# Phase 0 — Read-only intelligence + chat app

## Goal

Build a polished POC that proves three demo features and is architecturally ready to be pitched to the I/O Fund team as a member-facing product they could license or release.

The three hero features (all demo-ready by end of Phase 0):

1. **Natural-language chat** over IOF subscription content
2. **Weekly auto-digest** of new IOF activity, with auto-PR proposing updates to the distilled docs on content drift
3. **Portfolio gap analysis** (CSV upload → diff vs IOF current book, ranked by conviction context)

End-state framing: "Hi I/O Fund — here's a tool we built around your subscription. Interested in licensing or releasing this to members?"

## Architecture

```
┌─ INGEST (GH Actions cron, free tier) ──────────────────┐
│  poll-trades.yml      */30 * * * 1-5  → trades.csv    │
│  discover-articles.yml 0 14 * * *     → articles/idx  │
│  ingest-articles.yml   on-new          → articles/*.md │
└────────────┬───────────────────────────────────────────┘
             ↓
┌─ MAINTAIN (cron + LLM via AI Gateway) ─────────────────┐
│  weekly-digest.yml  0 21 * * 5                         │
│   • new trades summary                                 │
│   • new article summaries                              │
│   • flag staleness vs strategy.md + thesis.md          │
│   • auto-PR proposed doc updates to a branch           │
│   • email digest via Resend                            │
│  thesis-refresh.yml  monthly (later, optional)         │
└────────────┬───────────────────────────────────────────┘
             ↓
┌─ INTERFACE (Next.js + AI SDK + AI Gateway) ────────────┐
│  Sign-in with IOF account (Firebase auth via /api)     │
│  Chat (streamText + tools)                             │
│  Digest viewer                                         │
│  Portfolio gap (CSV upload → diff view)                │
│  Private URL until pitched to IOF                      │
└────────────────────────────────────────────────────────┘
```

## Decisions locked in (Phase 0)

| Decision | Choice | Reasoning |
|---|---|---|
| Chat UI | Next.js + AI SDK v6 + Vercel AI Gateway | Polished, mobile-friendly, fits the Vercel stack already implied by the session context |
| Auth | Real IOF Firebase auth from day one | "Sign in with your IOF account" is the hero demo moment |
| Cron | GitHub Actions | Free, observable, commits results back to repo as state |
| Storage — structured rows | Neon Postgres via Vercel Marketplace (Phase 0) | One-click provision, auto-injected `DATABASE_URL`. Trades + article metadata go here from day one. Adding pgvector for RAG (Phase 1) is then "ALTER TABLE add column," not a migration. Multi-tenant path is "add user_id + RLS," not a rewrite. Repo-as-DB was rejected on second look — see [Data architecture re-decision](#data-architecture-re-decision-2026-05-18). |
| Storage — prose | Git (markdown, PR-reviewed) | `data/io-fund-strategy.md`, `data/io-fund-thesis.md`, distilled article bodies (`data/articles/*.md`), digests (`data/digests/*.md`). Prose is human-edited and reviewed via PR; version control is the right tool. The chat system prompt reads from these at build time. |
| Data freshness contract | Two paths, by data type | (a) Structured writes (trades, article metadata) → Postgres → live instantly, no rebuild. (b) Prose edits (strategy/thesis updates, new distilled articles) → git commit → Vercel rebuild → live in ~30s–2min. Each kind of change triggers a rebuild exactly when it should. |
| User-uploaded data (portfolio CSVs) | Ephemeral, not committed, not persisted | Holdings uploaded in the chat app are processed in-memory per session, never written to `data/` and never persisted in Postgres in Phase 0. Phase 3 multi-tenant adds per-user encrypted store via Postgres RLS. |
| Digest delivery | Email via Resend | Free tier covers personal use; persistent + searchable |
| Doc-update flow | Auto-PR to a branch | LLM proposes edits to prose docs as a reviewable diff; Hunter approves manually. (Postgres-side writes from cron — new trade rows, article-metadata rows — go straight to DB; no PR.) |
| Chat access | Private URL + IOF auth | POC; not deployed publicly without IOF's blessing |
| LLM routing | Vercel AI Gateway with `"provider/model"` strings | Locked 2026-05-18. Single observable entry point, easy provider fallback. `AI_GATEWAY_API_KEY` provisioned in `.env` + GH secrets. |
| Per-task model picks (Phase 0) | Opus distillation · Sonnet chat · Haiku reserved | Decided 2026-05-18. Sonnet end-to-end for chat — no Haiku intent classifier yet. Defer routing layer until traffic/cost makes it worth a real seam. |
| Agent patterns | AI SDK v6 multi-step tool use for chat | Loop control via `stopWhen: stepCountIs(N)` or `ToolLoopAgent`. v5's `maxSteps` is deprecated — see Library notes in `pickup.md`. |
| Durable workflows | Defer Vercel Workflow DevKit | Add when actual durability needs emerge (digest pipeline, onboarding) |

### Data architecture re-decision (2026-05-18)

Original plan locked in "repo-as-DB initially," motivated by "no infra to provision." Re-examined and reversed:

- **The infra cost is illusory.** Neon via Vercel Marketplace is one click, free tier (3 GB / 191 compute hrs), auto-injects env vars. Zero ops cost in Phase 0.
- **The migration was inevitable.** The plan already triggered pgvector RAG at ~30 distilled articles — that's 3–6 months out at planned ingest rate. Committing to CSV / JSON until then is pure migration debt against the eventual Postgres schema.
- **Repo-as-DB has real query/concurrency/coupling costs** even at single-user scale: every cron-detected trade triggers a Vercel rebuild for what should be one row insert; "trades in last 90 days" requires loading the whole CSV; concurrent cron pushes can collide.
- **The hybrid is the architecture every grown-up app converges on:** Postgres for things you'd ever want to filter/sort/aggregate; git for prose humans edit and review.

Affects Tasks #2 (writes rows, not CSV), #3 (article metadata to Postgres, body stays as markdown), #5 (`query_trades` tool hits Postgres), #6 (gap-analysis trade replay from Postgres). Existing `data/iofund-trades.csv` + `.json` get seed-imported once, then become historical artifacts.

## Open decisions (defer until needed)

- **Prompt caching strategy** — critical for chat economics (~10× cost reduction). Surface in Task #5.
- **Branding / product name** — placeholder `iofund-agent`. Options floated: IOF Companion, IOF Compass, IOF Brief.
- **When to refactor for multi-tenant** — schema is already Postgres so this is "add user_id + RLS," not a data migration. Trigger before pitching to IOF.
- **Haiku intent classifier** — deferred. Add when (a) traffic justifies per-turn cost optimization, (b) tool list has grown enough that filtering by intent meaningfully reduces noise, or (c) you want product analytics on intent distribution. None apply yet.

### Recently closed (kept for context)

- **AI Gateway vs direct Anthropic API** — closed 2026-05-18 in favor of AI Gateway. `AI_GATEWAY_API_KEY` provisioned. Reasoning: unified provider API + observability + per-call cost tracking + zero-retention default outweigh the marginal markup at POC scale.
- **Repo-as-DB vs Postgres for Phase 0** — closed 2026-05-18 in favor of hybrid (Postgres for structured rows, git for prose). See [Data architecture re-decision](#data-architecture-re-decision-2026-05-18).
- **Per-task model picks** — closed 2026-05-18: Opus for distillation (#3), Sonnet end-to-end for chat (#5). Haiku deferred. See Phase-0 model row above.

## Cost shape (back-of-envelope, 2026 pricing ballparks)

| Operation | Frequency | Cost |
|---|---|---|
| Article distill (Opus) | ~5–10/wk | ~$5/wk max |
| Weekly digest (Sonnet) | 1/wk | ~$0.20–0.30 |
| Chat (Sonnet, w/ prompt caching) | per turn | ~$0.02 |
| Chat (no caching) | per turn | ~$0.10 |
| Neon Postgres | ongoing | $0 (free tier: 3 GB / 191 compute hrs) |
| **Monthly total during active POC use** | | **~$30–50** |

## IP / legal posture

- Using own credentials against IOF's auth: legitimate (Hunter's subscription).
- Distilled summaries: transformative, in private repo, personal use.
- Calling IOF's Firebase from a third-party server: **fine for a POC shown TO IOF**. Do NOT deploy publicly without their blessing.
- Shareable product version: per-user auth, content served only to authenticated subscribers, no central content redistribution.

## Phase 0 task list

> Tasks live in the Claude Code session task system. This list is the durable record across sessions; next session should `TaskCreate` these to re-populate the in-session list.

### Task #1 — Repo + GH Actions foundation

**Status:** pending. **Prereqs status:**
- `gh` CLI authenticated as `hunterphillips` ✓
- `RESEND_API_KEY` in `.env` ✓
- Digest email: `hkphillips42@gmail.com` ✓
- Repo visibility: private ✓
- AI Gateway key: deferred (doesn't block this task)

**Work:**
1. Write `.gitignore` (`.env`, `/tmp`, `node_modules/`, `.next/`, `.DS_Store`, `__pycache__/`, `.vercel/`)
2. `git init`
3. Add `.github/workflows/hello.yml` (smoke test: echoes secrets are set, no values exposed)
4. `gh repo create iofund-agent --private --source=. --remote=origin --push`
5. `gh secret set IO_FUND_USERNAME`, `IO_FUND_PASSWORD`, `RESEND_API_KEY` (read from `.env`)
6. Trigger workflow via `gh workflow run hello`
7. Report run URL for Hunter to verify CI works

**Gate before starting:** confirm with Hunter — creating the repo affects his account.

### Task #2 — Trade poll cron

**Status:** pending. **Depends on:** #1 + Neon provisioned.

**Work:**
- One-time `scripts/seed_trades.py` — read existing `data/iofund-trades.csv` and bulk-insert into Postgres `trades` table. Run locally; the CSV/JSON files then become historical artifacts (kept in git for provenance).
- `scripts/ingest_trades.py` — uses `iofund-fetch` skill; parses trades page (FIX the notes-column parser bug from earlier session — notes like `"3% trim"`, `"Close"`, `"1% Add"` were being dropped because they carry the position-sizing signal); upserts rows into Postgres with `ON CONFLICT DO NOTHING` for dedupe.
- Schema (initial): `trades(id, trade_date, ticker, side, notes, price, raw_row_hash, ingested_at)`. `raw_row_hash` is the dedup key. Drizzle migrations in `chat/db/` (chat app owns the schema; scripts import from there).
- Workflow `.github/workflows/poll-trades.yml`: cron `*/30 * * * 1-5` (every 30 min, weekdays). No git commit on no-op runs; emit a notification (Resend) only when N>0 new trades land.

### Task #3 — Article discovery + ingest

**Status:** pending. **Depends on:** #1 + Neon provisioned.

**Work:**
- `scripts/discover_articles.py` — polls `https://io-fund.com/rss.xml` daily; diffs against `articles` table in Postgres (existence by URL); emits new URLs via `repository_dispatch`.
- `scripts/ingest_article.py` — fetches a URL (premium via `iofund-fetch` skill, free via plain fetch); Opus distills to a structured markdown body; writes body to `data/articles/YYYY-MM-DD-slug.md` (PR for human review) and inserts metadata row into Postgres (`articles(id, url, pub_date, title, slug, premium, category, tickers[], distilled_path, ingested_at)`).
- The split is deliberate: prose body in git (reviewable, diff-able, version history), structured metadata in Postgres (queryable, joinable to trades by ticker, embeddable in Phase 1).
- Workflows: `discover-articles.yml` daily at 14:00 UTC (9am ET); `ingest-articles.yml` triggered via `repository_dispatch` from discovery.
- RSS feed observed to have ~40 items mixed free + premium. Free URLs: `/ai-stocks/*`, `/blogs/*`, `/artificial-intelligence/*` etc. Premium URLs: `/premium/*`.

### Task #4 — Weekly digest + auto-PR for doc updates

**Status:** pending. **Depends on:** #2, #3.

**Work:**
- `scripts/digest_week.py` — LLM run over the week's new trades + articles. Sections: new trades, new articles, flagged staleness vs current `data/io-fund-strategy.md` + `data/io-fund-thesis.md`. Output: `data/digests/YYYY-MM-DD.md`.
- If staleness detected: open a branch + PR with proposed edits to the distilled docs + evidence (article quotes / trade refs).
- Email summary to `hkphillips42@gmail.com` via Resend, with link to the PR (if any).
- Workflow `.github/workflows/weekly-digest.yml`: cron `0 21 * * 5` (Friday 5pm ET).

### Task #5 — Chat app (Next.js + AI SDK + AI Gateway)

**Status:** pending. **Depends on:** #1 minimally; visible value after auth + chat scaffold even before #2-4 are running. **Location:** `chat/` subdirectory (same repo, decided 2026-05-18).

**Work:**
- Scaffold Next.js 16 App Router app under `chat/`. Minimal first commit is just a placeholder page so Vercel deploys green; UI work iterates from there.
- **Evals harness in parallel.** `evals/` at repo root: `golden.jsonl` (~30 questions Hunter writes over time), `run_evals.py` (deterministic checks + Sonnet-as-judge for response quality), `judge_prompt.md`. Runs locally and as a GH Actions gate on PRs that touch chat prompts/tools/models. Started empty; populated as Hunter uses the app. Built before UI work so every chat change has a regression gate from day one.
- IOF Firebase auth flow: `/api/auth` calls `identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` with user creds → JWT in encrypted httpOnly cookie → session cookie for API calls.
- `/api/chat` route: AI SDK v6 multi-step tool use over `streamText` with system prompt seeded from `strategy.md` + `thesis.md` + recent trades summary (Postgres query). Tools: `read_doc`, `query_trades` (Postgres), `search_articles`, `read_article`. Loop control: `stopWhen: stepCountIs(5)` or `ToolLoopAgent`. Sonnet end-to-end — no intent classifier (deferred).
- **Design `search_articles` as a swap-in seam.** Phase 0 implementation = grep over `data/articles/*.md` bodies + Postgres metadata filter; Phase 1 implementation = vector search (pgvector column on the existing `articles` table — schema doesn't change, just adds a column). Same function signature, same return shape.
- Drizzle ORM for Postgres access (Vercel-friendly, TypeScript-first). Schema in `chat/db/schema.ts`; migrations via `drizzle-kit`.
- UI: chat pane (AI SDK `useChat`), digest viewer, portfolio gap upload + view.
- Brand: dark + gold palette to fit IOF's visual language. shadcn/ui components.
- Onboarding flow: 3-screen first-time experience (welcome → sign in → "we're fetching your latest" → first chat).
- States: loading, empty, error (wrong IOF password, no articles yet, etc.).
- Deployment: Vercel, private URL (Vercel password protection on top of IOF auth, or middleware enforcing IOF auth only).

### Task #6 — Portfolio gap analysis

**Status:** pending. **Depends on:** #5 (UI surface), trade-log replay logic from #2.

**Work:**
- CSV upload UI in the chat app. User CSVs are ephemeral — held in server-side session memory for the turn, never persisted.
- Diff engine: replay `trades` table (Postgres query, ordered by trade_date) to compute IOF current book → diff against uploaded holdings.
- Output: gaps (IOF holds, user doesn't) ranked by IOF position size + recency of accumulation; reverse gaps (user holds, IOF doesn't); size deltas where both hold.
- Conviction context per ticker pulled from `data/io-fund-thesis.md` (prose in git).
- LLM narrative explanation per top-N gaps.

## Recommended build sequence

1. Task #1 (repo + secrets)
2. Chat scaffold slice of Task #5 (fastest visual deliverable; reads from current `data/`)
3. Task #2 (trade poll keeps data fresh)
4. Task #3 (article ingest grows corpus)
5. Task #4 (digest + auto-PR ties it together)
6. Task #6 (gap analysis)
7. Polish pass (onboarding, brand, states)

## Future phases (out of scope for Phase 0)

### Phase 1 candidates

- **Alpaca read-only integration** (paper account first), real-time portfolio sync replacing CSV upload.
- **Faster IOF-alert ingest** via email→webhook (Resend inbound parse → `repository_dispatch`), eliminating 15-min poll lag.
- **RAG over the IOF article library.** Context-stuffing works for Phase 0 (<30 distilled articles, ~250KB total corpus). As the article archive grows, swap to retrieval. Implementation swap, not architectural rewrite — the `search_articles` tool stays as the seam (see Task #5 note). Neon is already provisioned (Phase 0), so this becomes "add pgvector extension + embedding column on `articles`," not a new infra setup.
  - **Trigger:** ~30–50 distilled articles OR chat latency >3s OR per-turn cost noticeably climbing.
  - **Stack:** pgvector on existing Neon Postgres (already provisioned in Phase 0).
  - **Embedding model:** Voyage `voyage-finance-2` (finance-domain-tuned, Anthropic-blessed for Claude apps); fallback OpenAI `text-embedding-3-small`.
  - **Reranking:** Cohere Rerank or Voyage Rerank — retrieve K=20 by vector similarity, rerank to top 5.
  - **Chunking:** section-level using markdown structure already present in distilled docs; metadata per chunk = `{article_url, section, tickers, themes, pub_date, premium}`.
  - **Retrieval mode:** hybrid (vector + BM25) for queries that include rare tickers / product names; pure vector alone struggles there.
  - **Agentic retrieval pattern:** chat agent calls `search_articles` multiple times per turn with refined queries via AI SDK v6's `stopWhen: stepCountIs(N)` loop (or `ToolLoopAgent`). Not a separate framework — just how the tool loop works.

### Phase 2 candidates

- **Semi-auto execution** (one-tap approve → broker), sizing rules engine, mock-portfolio backtesting harness on the historical trade log.

### Phase 3 candidates

- **Multi-tenant refactor** (per-user data scoping, per-user creds storage), formal IOF partnership discussion (official OAuth, white-label, etc.).
