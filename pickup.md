# Pickup — iofund-agent

**Last session:** 2026-05-18 (Opus 4.7) — planning + knowledge corpus consolidation; no implementation.
**Next session priority:** confirm Hunter is ready to execute Task #1, then execute it.

## Read in this order

1. `CLAUDE.md` — project orientation, repository layout, conventions, constraints
2. This file (`pickup.md`) — concrete next actions
3. `thoughts/shared/plans/iofund-agent-poc.md` — full architecture, decisions locked in, task list
4. `notes.md` — Hunter's original high-level system requirements (terse — 7 bullets)
5. (Optional, for deeper context) `data/io-fund-strategy.md` + `data/io-fund-thesis.md`

## Immediate next action: Task #1 (Repo + GH Actions foundation)

Hunter has provided everything needed:

- `gh` CLI authenticated as `hunterphillips` (ssh) ✓
- `RESEND_API_KEY` in `.env` ✓
- Digest email: `hkphillips42@gmail.com` ✓
- Repo visibility: private ✓
- AI Gateway key: **deferred** — Hunter still needs to decide AI Gateway vs direct Anthropic API. Does NOT block Task #1 (no LLM calls yet); blocks Task #3 onward.

**Before executing:** confirm with Hunter in one line — last session ended with him saying "stop trying to proceed with implementation." Don't assume the pause has lifted; explicitly ask "ready to run Task #1?" before doing it.

**If go:** execute these in order:

1. Write `.gitignore` covering `.env`, `/tmp`, `node_modules/`, `.next/`, `.vercel/`, `.DS_Store`, `__pycache__/`, `*.pyc`
2. `git init`
3. Add `.github/workflows/hello.yml` — a smoke-test workflow that prints `github.repository` and verifies each required secret is set (without echoing values)
4. `gh repo create iofund-agent --private --source=. --remote=origin --push`
5. `gh secret set IO_FUND_USERNAME` (from `.env`)
6. `gh secret set IO_FUND_PASSWORD` (from `.env`)
7. `gh secret set RESEND_API_KEY` (from `.env`)
8. Trigger workflow: `gh workflow run hello`
9. Wait, then `gh run list --workflow=hello --limit 1` → report URL to Hunter

## Open conversation threads from last session

| Thread | Status | Where to surface |
|---|---|---|
| **AI Gateway vs direct Anthropic API** | Hunter asked "what is AI Gateway for?" — I started answering when he asked to pause. Short answer: unified provider API + observability + fallbacks + zero retention; recommended default per Vercel context. He needs to decide before Task #3. | Surface at end of Task #1 or start of Task #2. |
| **Model selection per task** | Deferred. Opus for distillation, Sonnet for chat, Haiku for intent classification are my default recommendations. | Surface at start of Task #3. |
| **Prompt caching strategy** | Deferred. ~10× cost reduction for chat. AI SDK + Anthropic supports it natively. | Surface at start of Task #5. |
| **Branding / product name** | Placeholder `iofund-agent`. Options floated: IOF Companion, IOF Compass, IOF Brief. Hunter said pick later. | Surface before Task #5 polish pass. |
| **When to refactor `data/` for multi-tenant** | Hunter chose "keep in `data/` for now, refactor before pitching." | Surface before pitching, or when chat app is deployed to a wider audience. |

## What NOT to do (carryover from last session)

- **Don't reproduce IOF article prose verbatim** anywhere — in code, in docs, in chat output. The distilled docs in `data/` are transformative summaries; new article ingestion should be the same.
- **Don't deploy the chat app to a public URL** without Hunter's explicit go-ahead. Calling IOF's Firebase from a third-party server is fine for a POC shown TO IOF, but a public deploy without their blessing is bad IP posture.
- **Don't auto-commit changes to `data/io-fund-strategy.md` or `data/io-fund-thesis.md`** — the weekly digest workflow should auto-PR to a branch, not push to main. Hunter approves each PR manually.
- **Don't start LLM-using components (Task #3 onward)** until Hunter decides on AI Gateway vs direct Anthropic API.
- **Don't try to re-implement what's already in `.claude/skills/iofund-fetch/`** — it works (with one known bug, see below). Reuse it.

## Known bugs to fix in Task #2

- `iofund-fetch` skill currently parses trades but the **notes column is dropped** in the JSON output. Notes like `"3% trim"`, `"1% Add"`, `"Close"` carry the position-sizing signal — the strategy doc (§1 of `data/io-fund-strategy.md`) explains why this matters. Fix during Task #2 when porting the parser into `scripts/ingest_trades.py`.

## Library / API notes (read before starting affected tasks)

- **AI SDK v6 — loop control changed from v5.** The `maxSteps: N` parameter is **deprecated**. Use `stopWhen: stepCountIs(N)` on `streamText` / `generateText`, or — cleaner for chat — use the new `ToolLoopAgent` class from `ai` which handles loop management automatically. Default is `stepCountIs(20)` so we explicitly cap lower. Confirmed against ai-sdk.dev/docs/agents/loop-control on 2026-05-18. Affects **Task #5** (chat app). Older blog posts and tutorials will show the old `maxSteps` pattern — don't copy them.
- **Vercel data freshness model is explicit:** push-to-main triggers Vercel auto-redeploy (~30s–2min). Do **not** design runtime fetches against GitHub raw URLs as a workaround — Hunter explicitly chose the redeploy model. Cron commits → rebuild → live data.
- **User-uploaded data (portfolio CSVs) is ephemeral.** Process in-memory per session in the chat app. Never write to `data/` or commit. Affects **Task #6** (portfolio gap analysis).

## Session-recovery checklist

If this is a fresh Claude Code session and the in-session task list is empty, re-create the 6 Phase 0 tasks by reading the "Phase 0 task list" section of `thoughts/shared/plans/iofund-agent-poc.md` and calling `TaskCreate` for each one. The plan doc is the durable record; the task system is session-scoped.

## What "done" looks like for this session

Hunter expects this session to produce:

- `CLAUDE.md` at repo root ✓ (already done last session)
- Architecture plan + tasks under `thoughts/shared/plans/` ✓ (already done last session)
- `pickup.md` at repo root ✓ (this file)

Next session's "done" looks like: Task #1 complete and Hunter can see the hello-world workflow run green on GitHub.
