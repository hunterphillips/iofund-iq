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
| Storage | Repo-as-database initially | CSV / JSON / markdown committed back; DB later if/when needed |
| Data freshness contract | Push-to-main triggers Vercel auto-redeploy | Cron commits new `data/` → Vercel rebuild → live in ~30s–2min. Acceptable for chat (no sub-minute freshness need). |
| User-uploaded data (portfolio CSVs) | Ephemeral, not committed | Holdings uploaded in chat app are processed in-memory per session and **never written to `data/` or committed**. Phase 0 single-user scope = browser memory or session-scoped server state. Phase 3 multi-tenant adds per-user encrypted store (Vercel KV with per-user keys, or Neon row-level security). |
| Digest delivery | Email via Resend | Free tier covers personal use; persistent + searchable |
| Doc-update flow | Auto-PR to a branch | LLM proposes edits as a reviewable diff; Hunter approves manually |
| Chat access | Private URL + IOF auth | POC; not deployed publicly without IOF's blessing |
| Personal data location | Keep in `data/` for now | Iteration speed wins; refactor before pitching |
| LLM routing | Vercel AI Gateway with `"provider/model"` strings | Single observable entry point, easy provider fallback |
| Agent patterns | AI SDK multi-step tool use for chat | Built-in via `maxSteps`. No durable workflow framework yet. |
| Durable workflows | Defer Vercel Workflow DevKit | Add when actual durability needs emerge (digest pipeline, onboarding) |

## Open decisions (defer until needed)

- **AI Gateway vs direct Anthropic API** — Hunter to decide before Task #3 (first LLM call). Gateway is the recommended default. Direct API trades observability for ~no markup.
- **Per-task model selection** — Opus for distillation, Sonnet for chat, Haiku for intent classification. Concrete defaults set when Task #3 begins.
- **Prompt caching strategy** — critical for chat economics (~10× cost reduction). Surface in Task #5.
- **Branding / product name** — placeholder `iofund-agent`. Options floated: IOF Companion, IOF Compass, IOF Brief.
- **When to refactor `data/` for multi-tenant** — before pitching to IOF.

## Cost shape (back-of-envelope, 2026 pricing ballparks)

| Operation | Frequency | Cost |
|---|---|---|
| Article distill (Opus) | ~5–10/wk | ~$5/wk max |
| Weekly digest (Sonnet) | 1/wk | ~$0.20–0.30 |
| Chat (Sonnet, w/ prompt caching) | per turn | ~$0.02 |
| Chat (no caching) | per turn | ~$0.10 |
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

**Status:** pending. **Depends on:** #1.

**Work:**
- `scripts/ingest_trades.py` — uses `iofund-fetch` skill; parses trades page (FIX the notes-column parser bug from earlier session — notes like `"3% trim"`, `"Close"`, `"1% Add"` were being dropped); dedupes against `data/iofund-trades.csv`; appends new rows; commits.
- Workflow `.github/workflows/poll-trades.yml`: cron `*/30 * * * 1-5` (every 30 min, weekdays).
- Notification on new trades (channel TBD — likely email via Resend or GitHub commit notification).

### Task #3 — Article discovery + ingest

**Status:** pending. **Depends on:** #1, AI Gateway decision.

**Work:**
- `scripts/discover_articles.py` — polls `https://io-fund.com/rss.xml` daily; diffs against `data/articles/index.json`; emits new URLs.
- `scripts/ingest_article.py` — fetches a URL (premium via `iofund-fetch` skill, free via plain fetch); LLM-distills to `data/articles/YYYY-MM-DD-slug.md` with frontmatter (`url`, `pubDate`, `title`, `premium`, `category`).
- Workflows: `discover-articles.yml` daily at 14:00 UTC (9am ET); `ingest-articles.yml` triggered via `repository_dispatch` from the discovery workflow.
- RSS feed observed to have ~40 items mixed free + premium. Free URLs: `/ai-stocks/*`, `/blogs/*`, `/artificial-intelligence/*` etc. Premium URLs: `/premium/*`.

### Task #4 — Weekly digest + auto-PR for doc updates

**Status:** pending. **Depends on:** #2, #3.

**Work:**
- `scripts/digest_week.py` — LLM run over the week's new trades + articles. Sections: new trades, new articles, flagged staleness vs current `data/io-fund-strategy.md` + `data/io-fund-thesis.md`. Output: `data/digests/YYYY-MM-DD.md`.
- If staleness detected: open a branch + PR with proposed edits to the distilled docs + evidence (article quotes / trade refs).
- Email summary to `hkphillips42@gmail.com` via Resend, with link to the PR (if any).
- Workflow `.github/workflows/weekly-digest.yml`: cron `0 21 * * 5` (Friday 5pm ET).

### Task #5 — Chat app (Next.js + AI SDK + AI Gateway)

**Status:** pending. **Depends on:** #1 minimally; visible value after auth + chat scaffold even before #2-4 are running.

**Work:**
- Scaffold Next.js App Router app under `chat/` directory (or separate repo — decide at start).
- IOF Firebase auth flow: `/api/auth` calls `identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` with user creds → JWT in encrypted httpOnly cookie → session cookie for API calls.
- `/api/chat` route: AI SDK v6 multi-step tool use over `streamText` with system prompt seeded from `strategy.md` + `thesis.md` + recent trades summary. Tools: `read_doc`, `query_trades`, `search_articles`, `read_article`. Loop control: `stopWhen: stepCountIs(5)` (v5's `maxSteps` is deprecated). Consider `ToolLoopAgent` from `ai` for automatic loop management — it's the cleaner pattern for chat agents that may iterate over several tool calls per turn.
- **Design `search_articles` as a swap-in seam.** Phase 0 implementation = grep-over-markdown-files; Phase 1 implementation = vector search (see Future phases → RAG). Same function signature, same return shape — chat app doesn't change when retrieval swaps. This is the load-bearing detail for forward compatibility.
- UI: chat pane (AI SDK `useChat`), digest viewer, portfolio gap upload + view.
- Brand: dark + gold palette to fit IOF's visual language. shadcn/ui components.
- Onboarding flow: 3-screen first-time experience (welcome → sign in → "we're fetching your latest" → first chat).
- States: loading, empty, error (wrong IOF password, no articles yet, etc.).
- Deployment: Vercel, private URL (Vercel password protection on top of IOF auth, or middleware enforcing IOF auth only).

### Task #6 — Portfolio gap analysis

**Status:** pending. **Depends on:** #5 (UI surface), trade-log replay logic from #2.

**Work:**
- CSV upload UI in the chat app.
- Diff engine: replay `iofund-trades.csv` to compute IOF current book → diff against uploaded holdings.
- Output: gaps (IOF holds, user doesn't) ranked by IOF position size + recency of accumulation; reverse gaps (user holds, IOF doesn't); size deltas where both hold.
- Conviction context per ticker pulled from `data/io-fund-thesis.md`.
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
- **RAG over the IOF article library.** Context-stuffing works for Phase 0 (<30 distilled articles, ~250KB total corpus). As the article archive grows, swap to retrieval. Implementation swap, not architectural rewrite — the `search_articles` tool stays as the seam (see Task #5 note).
  - **Trigger:** ~30–50 distilled articles OR chat latency >3s OR per-turn cost noticeably climbing.
  - **Stack:** Neon Postgres + pgvector (via Vercel Marketplace; gives us a real Postgres for non-vector data too).
  - **Embedding model:** Voyage `voyage-finance-2` (finance-domain-tuned, Anthropic-blessed for Claude apps); fallback OpenAI `text-embedding-3-small`.
  - **Reranking:** Cohere Rerank or Voyage Rerank — retrieve K=20 by vector similarity, rerank to top 5.
  - **Chunking:** section-level using markdown structure already present in distilled docs; metadata per chunk = `{article_url, section, tickers, themes, pub_date, premium}`.
  - **Retrieval mode:** hybrid (vector + BM25) for queries that include rare tickers / product names; pure vector alone struggles there.
  - **Agentic retrieval pattern:** chat agent calls `search_articles` multiple times per turn with refined queries via AI SDK v6's `stopWhen: stepCountIs(N)` loop (or `ToolLoopAgent`). Not a separate framework — just how the tool loop works.

### Phase 2 candidates

- **Semi-auto execution** (one-tap approve → broker), sizing rules engine, mock-portfolio backtesting harness on the historical trade log.

### Phase 3 candidates

- **Multi-tenant refactor** (per-user data scoping, per-user creds storage), formal IOF partnership discussion (official OAuth, white-label, etc.).
