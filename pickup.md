# Pickup — iofund-agent

**Last session:** 2026-05-18 (Opus 4.7) — Task #1 complete (repo bootstrapped + hello workflow green). Also: AI Gateway decision locked in.
**Next session priority:** ask Hunter which of the unblocked tasks to take next — recommended is the chat scaffold slice of Task #5 (fastest visual deliverable per the plan's build sequence).

## Read in this order

1. `CLAUDE.md` — project orientation, repository layout, conventions, constraints
2. This file (`pickup.md`) — concrete next actions
3. `thoughts/shared/plans/iofund-agent-poc.md` — full architecture, decisions locked in, task list
4. `notes.md` — Hunter's original high-level system requirements (terse — 7 bullets)
5. (Optional, for deeper context) `data/io-fund-strategy.md` + `data/io-fund-thesis.md`

## What's done

- **Task #1 — Repo + GH Actions foundation** ✓
  - Repo: `https://github.com/hunterphillips/iofund-agent` (private)
  - `.gitignore` covers `.env`, Claude local settings, build artifacts
  - `.github/workflows/hello.yml` — manual workflow that verifies the 4 required secrets are set
  - Hello run green: `https://github.com/hunterphillips/iofund-agent/actions/runs/26040340073`
  - GH secrets pushed: `IO_FUND_USERNAME`, `IO_FUND_PASSWORD`, `RESEND_API_KEY`, `AI_GATEWAY_API_KEY`
  - **Gotcha for future bootstrap-style work:** `gh secret set --env-file .env` is the robust way to push secrets from a dotenv file. `source .env` can silently drop values that contain shell metacharacters.

## What's unblocked

- **Task #2 — Trade poll cron** (now unblocked by #1)
- **Task #3 — Article discovery + ingest** (unblocked by #1 + AI Gateway decision)
- **Task #5 — Chat app scaffold** (unblocked by #1) — **recommended next** per the plan's build sequence (fastest visual deliverable)

Tasks #4 and #6 remain blocked on prerequisites.

## Immediate next action: pick the next task with Hunter

Plan recommends Task #5 chat-scaffold next, but the trade-poll cron (#2) keeps data fresh and unblocks the digest. Ask Hunter which to take. If the answer is Task #5, key opening questions:

- Chat app: **same repo (`/chat` subdir)** or **separate repo**? Plan leaves this open.
- Per-task model picks for Phase 0? Defaults to confirm: Opus for distillation (#3), Sonnet for chat (#5), Haiku for intent classification.
- Vercel project setup — link now or after first scaffold commit?

## Open conversation threads (carryover)

| Thread | Status | Where to surface |
|---|---|---|
| **AI Gateway vs direct Anthropic API** | ✓ Resolved 2026-05-18 — AI Gateway chosen. `AI_GATEWAY_API_KEY` is in `.env` and as a GH secret. | n/a |
| **Model selection per task** | Open. Opus distillation / Sonnet chat / Haiku intent are my defaults. | Surface at start of #3 or #5 (whichever comes first). |
| **Prompt caching strategy** | Open. ~10× cost reduction for chat. AI SDK + Anthropic supports it natively. | Surface at start of #5. |
| **Branding / product name** | Placeholder `iofund-agent`. Options floated: IOF Companion, IOF Compass, IOF Brief. | Surface before #5 polish pass. |
| **When to refactor `data/` for multi-tenant** | "Keep in `data/` for now, refactor before pitching." | Surface before pitching, or when chat app goes wider. |

## What NOT to do (carryover)

- **Don't reproduce IOF article prose verbatim** anywhere — in code, in docs, in chat output. The distilled docs in `data/` are transformative summaries; new article ingestion should be the same.
- **Don't deploy the chat app to a public URL** without Hunter's explicit go-ahead. Calling IOF's Firebase from a third-party server is fine for a POC shown TO IOF, but a public deploy without their blessing is bad IP posture.
- **Don't auto-commit changes to `data/io-fund-strategy.md` or `data/io-fund-thesis.md`** — the weekly digest workflow should auto-PR to a branch, not push to main. Hunter approves each PR manually.
- **Don't try to re-implement what's already in `.claude/skills/iofund-fetch/`** — it works (with one known bug, see below). Reuse it.

## Known bugs to fix when relevant

- `iofund-fetch` skill currently parses trades but the **notes column is dropped** in the JSON output. Notes like `"3% trim"`, `"1% Add"`, `"Close"` carry the position-sizing signal — the strategy doc (§1 of `data/io-fund-strategy.md`) explains why this matters. Fix during Task #2 when porting the parser into `scripts/ingest_trades.py`.

## Library / API notes (read before starting affected tasks)

- **AI SDK v6 — loop control changed from v5.** The `maxSteps: N` parameter is **deprecated**. Use `stopWhen: stepCountIs(N)` on `streamText` / `generateText`, or — cleaner for chat — use the new `ToolLoopAgent` class from `ai` which handles loop management automatically. Default is `stepCountIs(20)` so we explicitly cap lower. Confirmed against ai-sdk.dev/docs/agents/loop-control on 2026-05-18. Affects **Task #5** (chat app). Older blog posts and tutorials will show the old `maxSteps` pattern — don't copy them.
- **Vercel data freshness model is explicit:** push-to-main triggers Vercel auto-redeploy (~30s–2min). Do **not** design runtime fetches against GitHub raw URLs as a workaround — Hunter explicitly chose the redeploy model. Cron commits → rebuild → live data.
- **User-uploaded data (portfolio CSVs) is ephemeral.** Process in-memory per session in the chat app. Never write to `data/` or commit. Affects **Task #6** (portfolio gap analysis).

## Session-recovery checklist

If this is a fresh Claude Code session and the in-session task list is empty, re-create the Phase 0 tasks by reading the "Phase 0 task list" section of `thoughts/shared/plans/iofund-agent-poc.md` and calling `TaskCreate` for each. Mark #1 completed (this file is the durable record). Set up `blockedBy` relationships: #2,#3,#5 blocked by #1; #4 blocked by #2,#3; #6 blocked by #5,#2.
