# iofund-agent

Personal AI assistant for getting more value out of an I/O Fund subscription. Long-term goal: a polished POC that can be pitched to the I/O Fund team as a member-facing product they could license or release to subscribers.

## Current state

Pre-build planning phase. The knowledge corpus and ingest skill are built; no application code or workflows yet. Next session should pick up at Task #1 (repo + GH Actions foundation) — see `pickup.md`.

## Repository layout

| Path | Purpose |
|---|---|
| `data/io-fund-strategy.md` | Alert decoding, sizing rules, hedging framework. Load-bearing for interpreting any IOF trade signal. |
| `data/io-fund-thesis.md` | Current IOF thesis state, per-ticker conviction history, theme evolution, decision-reasoning patterns. |
| `data/iofund-trades.csv` | Raw IOF trade log, ~1,044 entries Jan 2021 – May 2026. Source of truth for IOF positions. |
| `data/iofund-trades.json` | Same data, JSON for structured queries. |
| `data/io-fund-portfolio.pdf` | Historical snapshot — stale, reference only. |
| `.claude/skills/iofund-fetch/` | Python skill: authenticates against io-fund.com Firebase, fetches premium articles. |
| `thoughts/shared/plans/iofund-agent-poc.md` | Full architecture plan + Phase 0 task list + decisions locked in. |
| `pickup.md` | Where the next agent session should start. |
| `notes.md` | Hunter's original high-level system requirements. |
| `.env` | Local secrets (NOT committed) — `IO_FUND_USERNAME`, `IO_FUND_PASSWORD`, `RESEND_API_KEY`. |

## Tech stack (planned)

- **Frontend / chat:** Next.js App Router + AI SDK v6 + Vercel AI Gateway
- **Backend / ingest:** GitHub Actions cron + Python scripts (using `iofund-fetch` skill)
- **Email:** Resend (weekly digest)
- **Storage:** Repo-as-database initially (CSV / JSON / markdown committed back). DB only when needed.
- **Durable workflows (later):** Vercel Workflow DevKit for digest pipeline, thesis refresh, onboarding

## Conventions and guardrails

- **IOF subscription content is paid material.** Never reproduce article prose verbatim. The two distilled docs in `data/` are transformative summaries (frontmatter + structured tables, not copied prose). When showing IOF content in the eventual product, always require user auth against IOF and cite back to the original URL.
- **The trade log is the source of truth** for IOF positions, not the (stale) portfolio PDF.
- **The distilled markdown docs in `data/` have frontmatter** (`load_priority`, `companion_docs`) and are optimized for agent consumption. Treat them as the project's knowledge backbone.
- **Hunter has an active IOF subscription** — `iofund-fetch` authenticates with his credentials in `.env`. Polling IOF is authorized by his subscription.
- **Plans + handoffs** live in `thoughts/shared/plans/` and `pickup.md` per Claude Code conventions (the `create_plan`, `handoff`, and `pickup` skills use these paths).

## End-goal product (Phase 0+ target)

Three hero features, all demo-ready:

1. **Natural-language chat** over the user's IOF subscription content
2. **Weekly auto-digest** of new IOF activity (email + in-app archive), with auto-PR proposing updates to the distilled docs when content drift is detected
3. **Personal portfolio gap analysis** (CSV upload → diff vs IOF current book, with conviction context)

Architecture is designed for single-user POC but multi-tenant-ready (per-user auth and data scoping from day one, so the eventual shareable version is not a rewrite).

## Phases

- **Phase 0** (current): read-only intelligence + chat app
- **Phase 1**: live broker integration (Alpaca paper → live), real-time portfolio sync
- **Phase 2**: semi-auto execution (one-tap approve → broker)
- **Phase 3**: multi-tenant refactor + formal pitch to IOF team

## Orientation for new sessions

1. This file (you're here)
2. `pickup.md` — concrete next actions for *this* session
3. `thoughts/shared/plans/iofund-agent-poc.md` — full plan + open questions + task list
4. `data/io-fund-strategy.md` + `data/io-fund-thesis.md` — what IOF actually is and how they trade

## Important constraints

- Do **not** auto-commit changes to the distilled docs (`data/io-fund-strategy.md`, `data/io-fund-thesis.md`) without Hunter's approval. The weekly digest workflow should auto-PR to a branch.
- Do **not** deploy the chat app to a public URL without explicit go-ahead. Calling IOF's Firebase from a third-party server is fine for a POC shown TO IOF, but a public deploy without their blessing is bad IP posture.
- Do **not** start building LLM-using components until Hunter decides on AI Gateway vs direct Anthropic API. The first LLM caller is Task #3 (article distillation).
