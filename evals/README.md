# evals — chat behavior regression gate

Lightweight evals harness for the iofund-agent chat app. Runs locally and as
a GH Actions gate on PRs that touch chat prompts, tools, or model picks.

**Why:** every change to the chat system prompt, tool list, or model selection
risks regressing some answer that already worked. The gate catches the worst
cases before merge. Aim for *useful*, not *comprehensive* — 30–50 well-chosen
examples beats 500 noisy ones.

## Layout (planned — populated in Task #5)

| File | Purpose |
|---|---|
| `golden.jsonl` | One JSON object per line: `{question, expected_intent?, must_cite?, must_not_cite?, rubric?}`. Hunter writes new cases as he uses the app. |
| `run_evals.py` | Iterates `golden.jsonl`, calls the chat endpoint for each, scores with deterministic checks + LLM-as-judge, prints a summary. |
| `judge_prompt.md` | Rubric for the Sonnet-as-judge call (faithfulness to source, no verbatim IOF prose, citation correctness). |
| `.github/workflows/evals.yml` | PR gate; runs `run_evals.py` against a preview deploy. Fails if regression count > N. |

## Scoring philosophy

Two scoring modes per example:

- **Deterministic checks** — regex / substring tests for `must_cite` (e.g. a
  specific trade date or article URL), `must_not_cite` (e.g. a literal IOF
  article quote, since the corpus is paid material).
- **LLM-as-judge** — Sonnet scores the response 1–5 against `rubric`. Catches
  quality regressions deterministic checks can't.

A run is green if every example passes its deterministic checks AND the
mean LLM-as-judge score is ≥ 4.0.

## Status

Skeleton only — `golden.jsonl` and `run_evals.py` land with the first
`/api/chat` implementation in Task #5.
