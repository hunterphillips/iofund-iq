#!/usr/bin/env python3
"""Generate the weekly IOF digest, optionally open a doc-update PR, email it.

Runs weekly via .github/workflows/weekly-digest.yml (Friday 21:00 UTC).
Reads past-7d trades + articles from Postgres, drafts a structured digest
via AI Gateway (Sonnet 4.6), writes data/digests/YYYY-MM-DD.md, commits.
Then: second LLM call checks for staleness in data/io-fund-thesis.agent.md
(the agent doc, which holds the per-ticker picks table the drift check reads).
If drift is found, a third call regenerates the human-facing io-fund-thesis.md
page from the same evidence in its own editorial voice, and a single PR proposes
edits to both docs so they stay in sync automatically. Finally emails the summary via
Resend to hkphillips42@gmail.com.

This is the ONLY outbound email from the system per the locked scope
decision (2026-05-19).

Required env:
    DATABASE_URL          — Neon Postgres
    AI_GATEWAY_API_KEY    — Vercel AI Gateway
    RESEND_API_KEY        — Resend transactional email (skip with DIGEST_SKIP_EMAIL=1)
    GITHUB_TOKEN          — gh CLI auth (auto-injected on GHA; locally:
                            export GITHUB_TOKEN=$(gh auth token))

Optional env:
    DIGEST_DRY_RUN          — "1" skips DB writes, LLM calls, PR, email
    DIGEST_FORCE_OVERWRITE  — "1" overwrites today's digest file if present
    DIGEST_SKIP_EMAIL       — "1" runs the digest + (optional) PR but no email
    DIGEST_SKIP_PR          — "1" runs the digest + email but no staleness PR
    DIGEST_RECIPIENT        — override default recipient (Hunter's email)
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import markdown as md_lib
import psycopg

AI_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions"
RESEND_URL = "https://api.resend.com/emails"
MODEL = "anthropic/claude-sonnet-4-6"
DEFAULT_RECIPIENT = "hkphillips42@gmail.com"
RESEND_FROM = "IOFund Digest <onboarding@resend.dev>"
REPO_OWNER = "hunterphillips"
REPO_NAME = "iofund-agent"


DIGEST_SYSTEM_PROMPT = """You are writing a weekly digest of I/O Fund activity for a personal AI assistant subscriber. The audience already follows I/O Fund — keep it sharp, scannable, and trader-pragmatic. NEVER quote I/O Fund article prose verbatim; paraphrase strictly.

In prose, refer to the firm as "I/O Fund", "the fund", or "the firm" — never the internal shorthand "IOF".

Structure the digest in this exact order, with `## ` h2 headings:

## Week at a glance
2-3 sentence framing. What was the dominant theme? Was the fund active or quiet?

## New trades
For each trade: date · TICKER · ACTION (price if known) · paraphrased note.
If 0 trades: a single line "No new trades this week."

## New articles
For each article: title (linked to URL), pub date, 1-sentence paraphrased thesis, primary tickers tagged.
If 0 articles: a single line "No new articles this week."

## Themes & patterns
2-4 bullets identifying recurring themes ACROSS the week's activity (e.g., "all three trades were trims," "two articles re-emphasized optical bottleneck"). Skip this section if there's not enough material.

## What to watch
1-2 forward-looking bullets — what should the subscriber pay attention to next week, based on what the fund did this week? Keep grounded in the week's evidence; don't speculate beyond it.

Be terse. 300-600 words total. Use markdown links for article URLs. Keep tickers UPPERCASE."""


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def load_dotenv_if_present() -> None:
    """Lightweight .env loader — script root, then repo root."""
    here = Path(__file__).resolve().parent
    for d in (here, here.parent):
        env_path = d / ".env"
        if not env_path.is_file():
            continue
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"ERROR: {name} is not set")
    return value


def window_for(today: date) -> tuple[date, date]:
    """Returns (start, end) inclusive of a 7-day window ending today."""
    return today - timedelta(days=6), today


def digest_path(repo_root: Path, run_date: date) -> Path:
    return repo_root / "data" / "digests" / f"{run_date.isoformat()}.md"


def fetch_week_trades(conn: psycopg.Connection, start: date, end: date) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT trade_date, ticker, action, price, note, analyst
            FROM trades
            WHERE trade_date BETWEEN %s AND %s
            ORDER BY trade_date DESC, ticker
            """,
            (start, end),
        )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def fetch_week_articles(conn: psycopg.Connection, start: date, end: date) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT url, title, pub_date, category, tickers, body
            FROM articles
            WHERE pub_date BETWEEN %s AND %s
            ORDER BY pub_date DESC
            """,
            (start, end),
        )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def _build_digest_user_msg(
    run_date: date,
    start: date,
    end: date,
    trades: list[dict],
    articles: list[dict],
) -> str:
    lines = [
        f"WINDOW: {start.isoformat()} → {end.isoformat()} (inclusive)",
        f"RUN_DATE: {run_date.isoformat()}",
        "",
        f"## Trades this week ({len(trades)})",
    ]
    for t in trades:
        price = f" @ ${t['price']}" if t.get("price") else ""
        note = f" — {t['note']}" if t.get("note") else ""
        lines.append(
            f"- {t['trade_date'].isoformat()} · {t['ticker']} · {t['action']}{price}{note}"
        )
    lines.append("")
    lines.append(f"## Articles this week ({len(articles)})")
    for a in articles:
        tickers = ", ".join(a.get("tickers") or [])
        lines.append(
            f"\n### {a['title']}\n"
            f"URL: {a['url']}\n"
            f"Published: {a['pub_date'].isoformat()}\n"
            f"Category: {a.get('category') or 'n/a'}\n"
            f"Tickers: {tickers}\n\n"
            f"{a.get('body') or '(no body)'}\n"
        )
    return "\n".join(lines)


def _call_ai_gateway(
    api_key: str,
    *,
    system: str,
    user: str,
    max_tokens: int,
    temperature: float = 0.3,
) -> str:
    payload = {
        "model": MODEL,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    req = urllib.request.Request(
        AI_GATEWAY_URL,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"AI Gateway {e.code}: {detail}") from e
    return body["choices"][0]["message"]["content"]


def generate_digest(
    api_key: str,
    run_date: date,
    start: date,
    end: date,
    trades: list[dict],
    articles: list[dict],
) -> str:
    user_msg = _build_digest_user_msg(run_date, start, end, trades, articles)
    return _call_ai_gateway(
        api_key,
        system=DIGEST_SYSTEM_PROMPT,
        user=user_msg,
        max_tokens=1500,
    )


def write_digest(repo_root: Path, run_date: date, body: str, force: bool) -> Path:
    target = digest_path(repo_root, run_date)
    if target.exists() and not force:
        raise SystemExit(
            f"digest already exists at {target}; set DIGEST_FORCE_OVERWRITE=1 to overwrite"
        )
    target.parent.mkdir(parents=True, exist_ok=True)
    header = (
        "---\n"
        f"run_date: {run_date.isoformat()}\n"
        f"generated_at: {datetime.now(UTC).isoformat()}\n"
        "---\n\n"
    )
    target.write_text(header + body.rstrip() + "\n")
    return target


def _run(cmd: list[str], *, cwd: Path, check: bool = True) -> subprocess.CompletedProcess:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if check and result.returncode != 0:
        raise RuntimeError(
            f"{' '.join(cmd)} failed [{result.returncode}]: {result.stderr.strip()}"
        )
    return result


def commit_and_push_digest(repo_root: Path, target: Path, run_date: date) -> None:
    """Stage + commit + push the digest file. Idempotent — if nothing to commit, skip.

    Must run BEFORE staleness PR creation so the PR branch forks off a main
    that already has the digest landed.
    """
    _run(
        ["git", "config", "user.name", "github-actions[bot]"],
        cwd=repo_root,
        check=False,
    )
    _run(
        ["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"],
        cwd=repo_root,
        check=False,
    )
    _run(["git", "add", str(target.relative_to(repo_root))], cwd=repo_root)
    status = _run(["git", "diff", "--staged", "--quiet"], cwd=repo_root, check=False)
    if status.returncode == 0:
        log("commit: digest already committed; skipping")
        return
    _run(
        ["git", "commit", "-m", f"Digest for week of {run_date.isoformat()}"],
        cwd=repo_root,
    )
    _run(["git", "push"], cwd=repo_root)
    log("commit: digest committed + pushed to main")


STALENESS_SYSTEM_PROMPT = """You are reviewing whether I/O Fund's published thesis doc needs updates based on this week's activity.

You will be given:
1. The current data/io-fund-thesis.agent.md content (load-bearing — describes IOF's current investment thesis, per-ticker conviction, themes, headline moves).
2. This week's IOF trades (table format).
3. This week's distilled IOF articles (with thesis + key numbers).

Your task: identify whether the thesis doc is now stale or contradicted by this week's activity. Drift means "the doc is now demonstrably wrong or missing a load-bearing fact," not "I could phrase this better."

Drift you SHOULD flag:
- A ticker the doc lists as ✓ held that has been fully closed or majorly trimmed (≥50%) in the trade log. Example: doc says "RDDT — held, thesis stable" but trade log shows "RDDT · SELL — closed" this week → drift, propose updating the picks table and timeline.
- Numbers in the doc that a new article supersedes with materially different figures (e.g., doc says "+1000% from entry" but article gives "+1,300% from entry") → drift, update the number.
- A new theme appearing in 2+ articles this week that's absent from the doc's "Active themes" section.

Drift you should NOT flag:
- A single new article on a single ticker (one data point isn't a theme).
- Stylistic preferences. The doc as-is is fine prose.
- Speculative additions ("might be worth adding").

If no drift exists, respond with just: NO_CHANGES

If drift exists, output the proposed replacement file. Format requirements:
- Start your output with the `---` of the YAML frontmatter. No narrative preamble, no "Looking at this week..." reasoning, no ```markdown code fence — the output is written directly to disk and parsed by the file's frontmatter delimiter.
- Preserve original frontmatter keys (`purpose`, `note`, `load_priority`, `audience`, `quarters_covered`, `sources`, `companion_docs`); bump `last_distilled` to {run_date}.
- Touch only the sections this week's activity actually warrants. Leave the rest of the file byte-identical.
- After the proposed file, on a new line, output literally `---EVIDENCE---` followed by a bulleted list citing article URLs / trade dates+tickers that justified each change."""


HUMAN_THESIS_UPDATE_SYSTEM_PROMPT = """You maintain the human-facing I/O Fund thesis page (data/io-fund-thesis.md). It is editorial prose written for a subscriber to read, NOT for an AI agent.

The structured thesis data was just updated to reflect this week's I/O Fund activity. Your job is to bring this human page in line with those same changes, in the same voice.

You will be given:
1. The current human-facing thesis page (full file).
2. The changes detected this week (with citations) and this week's trades.

Rules:
- Touch ONLY what the changes require: a position that was opened, trimmed, or closed; a number a new article materially supersedes; a clearly new theme. Leave everything else byte-identical.
- Keep the page's existing voice and structure. Plain editorial prose, sentence-case headings, no "agent", no "load-bearing", no decoder or meta-commentary, no per-ticker matrix.
- When a position's status changes, update the "What's held now" table AND any prose that names it (e.g. a closed ticker moves out of the held table and gets reflected in the surrounding prose).
- Do not invent facts. Only reflect the provided changes.

Output requirements:
- Start your output with the `---` of the YAML frontmatter. No preamble, no ```markdown code fence — the output is written directly to disk.
- Preserve the existing frontmatter keys (`purpose`, `audience`, `quarters_covered`, `sources`); bump `last_updated` to {run_date}.
- If none of the changes affect this page, respond with just: NO_CHANGES"""


def check_staleness(
    api_key: str,
    run_date: date,
    thesis_md: str,
    trades: list[dict],
    articles: list[dict],
) -> tuple[str | None, str | None]:
    """Returns (proposed_thesis_md, evidence_md) if drift detected; (None, None) otherwise."""
    user_msg_parts = [
        f"RUN_DATE: {run_date.isoformat()}",
        "",
        "=== CURRENT data/io-fund-thesis.md ===",
        thesis_md,
        "",
        f"=== THIS WEEK'S TRADES ({len(trades)}) ===",
    ]
    for t in trades:
        price = f" @ ${t['price']}" if t.get("price") else ""
        note = f" — {t['note']}" if t.get("note") else ""
        user_msg_parts.append(
            f"- {t['trade_date'].isoformat()} · {t['ticker']} · {t['action']}{price}{note}"
        )
    user_msg_parts.append("")
    user_msg_parts.append(f"=== THIS WEEK'S ARTICLES ({len(articles)}) ===")
    for a in articles:
        user_msg_parts.append("")
        user_msg_parts.append(
            f"--- {a['title']} ({a['url']}) — {a['pub_date'].isoformat()} ---"
        )
        user_msg_parts.append(a.get("body") or "(no body)")

    raw = _call_ai_gateway(
        api_key,
        system=STALENESS_SYSTEM_PROMPT.format(run_date=run_date.isoformat()),
        user="\n".join(user_msg_parts),
        max_tokens=8000,
        temperature=0.1,
    )

    if os.environ.get("DIGEST_DEBUG_STALENESS") == "1":
        log(f"staleness: raw response (first 500 chars):\n{raw[:500]}")

    stripped = raw.strip()
    # Tolerate the model wrapping NO_CHANGES with quotes or markdown.
    if re.match(r'^["`]*NO_CHANGES["`]*$', stripped.split("\n", 1)[0].strip()):
        return None, None

    if "---EVIDENCE---" not in raw:
        log("staleness: LLM returned content without ---EVIDENCE--- delimiter; treating as no-change")
        return None, None

    proposed, evidence = raw.split("---EVIDENCE---", 1)
    proposed = proposed.strip()

    # Strip ```markdown / ``` code-fence wrappers anywhere at the boundaries.
    proposed = re.sub(r"^```(?:markdown|md)?\s*\n", "", proposed)
    proposed = re.sub(r"\n```\s*$", "", proposed)

    # Skip any chain-of-thought preamble before the YAML frontmatter delimiter.
    # The thesis file must start with `---` on its own line; anything before
    # the first such delimiter is reasoning that leaked into the output.
    fm_match = re.search(r"^---\s*$", proposed, re.MULTILINE)
    if not fm_match:
        log("staleness: proposed thesis has no YAML frontmatter delimiter; treating as no-change")
        return None, None
    proposed = proposed[fm_match.start():].strip() + "\n"
    return proposed, evidence.strip()


def update_human_thesis(
    api_key: str,
    run_date: date,
    human_md: str,
    evidence: str,
    trades: list[dict],
) -> str | None:
    """Regenerate the human-facing thesis page from the drift evidence, in its own
    voice. Returns the proposed page, or None if nothing on it needs to change.

    Driven by the SAME drift evidence the agent-doc pass produced, so the two docs
    stay consistent without a separate drift detection.
    """
    trade_lines = []
    for t in trades:
        price = f" @ ${t['price']}" if t.get("price") else ""
        note = f" — {t['note']}" if t.get("note") else ""
        trade_lines.append(
            f"- {t['trade_date'].isoformat()} · {t['ticker']} · {t['action']}{price}{note}"
        )

    user_msg = "\n".join(
        [
            f"RUN_DATE: {run_date.isoformat()}",
            "",
            "=== CURRENT data/io-fund-thesis.md (human page) ===",
            human_md,
            "",
            "=== CHANGES DETECTED THIS WEEK ===",
            evidence,
            "",
            f"=== THIS WEEK'S TRADES ({len(trades)}) ===",
            *trade_lines,
        ]
    )

    raw = _call_ai_gateway(
        api_key,
        system=HUMAN_THESIS_UPDATE_SYSTEM_PROMPT.format(run_date=run_date.isoformat()),
        user=user_msg,
        max_tokens=8000,
        temperature=0.2,
    )

    stripped = raw.strip()
    if re.match(r'^["`]*NO_CHANGES["`]*$', stripped.split("\n", 1)[0].strip()):
        return None

    proposed = re.sub(r"^```(?:markdown|md)?\s*\n", "", stripped)
    proposed = re.sub(r"\n```\s*$", "", proposed)
    fm_match = re.search(r"^---\s*$", proposed, re.MULTILINE)
    if not fm_match:
        log("human-thesis: proposed page has no YAML frontmatter delimiter; skipping")
        return None
    return proposed[fm_match.start():].strip() + "\n"


def open_thesis_pr(
    repo_root: Path,
    run_date: date,
    proposed_agent: str,
    proposed_human: str | None,
    evidence: str,
) -> str | None:
    """Creates a branch, commits whichever thesis docs actually changed (the agent
    decoder and/or the human-facing page), pushes, opens a PR. Returns PR URL or None.
    """
    branch = f"digest/{run_date.isoformat()}-thesis-update"
    agent_path = repo_root / "data" / "io-fund-thesis.agent.md"
    human_path = repo_root / "data" / "io-fund-thesis.md"

    # Only write docs that differ from what's on disk (byte-equal = no real change).
    pending: list[tuple[Path, str]] = []
    if proposed_agent.strip() != agent_path.read_text().strip():
        pending.append((agent_path, proposed_agent))
    if proposed_human and proposed_human.strip() != human_path.read_text().strip():
        pending.append((human_path, proposed_human))

    if not pending:
        log("staleness: proposed docs are byte-equal to current; skipping PR")
        return None

    _run(["git", "checkout", "-b", branch], cwd=repo_root)
    try:
        for path, content in pending:
            path.write_text(content)
            _run(["git", "add", str(path.relative_to(repo_root))], cwd=repo_root)
        changed = ", ".join(p.name for p, _ in pending)
        _run(
            ["git", "commit", "-m", f"Digest {run_date.isoformat()}: propose thesis update ({changed})"],
            cwd=repo_root,
        )
        _run(["git", "push", "-u", "origin", branch], cwd=repo_root)

        title = f"Thesis update — week of {run_date.isoformat()}"
        body = (
            f"Automated proposal from `weekly-digest.yml` for the week ending {run_date.isoformat()}.\n\n"
            f"Updated: {changed}\n\n"
            f"## Evidence\n\n{evidence}\n\n"
            "## Review checklist\n"
            "- [ ] Each proposed change cites real article URLs / trade rows from this week\n"
            "- [ ] Only sections justified by this week's activity are modified\n"
            "- [ ] The human page (`io-fund-thesis.md`) keeps its plain editorial voice (no agent/decoder language)\n"
            "- [ ] Frontmatter dates bumped (`last_distilled` on the agent doc, `last_updated` on the human page)\n"
            "- [ ] Digest itself (`data/digests/...md`) already landed on main in a prior commit\n"
        )
        result = subprocess.run(
            ["gh", "pr", "create", "--base", "main", "--head", branch,
             "--title", title, "--body", body],
            cwd=repo_root, capture_output=True, text=True,
        )
        if result.returncode != 0:
            log(f"gh pr create failed: {result.stderr.strip()}")
            return None
        url = result.stdout.strip()
        log(f"opened PR: {url}")
        return url
    finally:
        # Always switch back to main, even on failure.
        _run(["git", "checkout", "main"], cwd=repo_root, check=False)


def render_email_html(
    digest_body: str,
    run_date: date,
    digest_blob_url: str,
    pr_url: str | None,
) -> str:
    """Render digest markdown to inline-styled HTML for Gmail-compatible delivery."""
    rendered = md_lib.markdown(
        digest_body,
        extensions=["fenced_code", "tables"],
    )
    pr_block = (
        f'<p style="margin-top:1.5em;padding:0.75em;background:#fff8e1;'
        f'border-left:3px solid #d4af37;font-size:0.95em">'
        f'<strong>Doc update proposed:</strong> '
        f'<a href="{pr_url}" style="color:#7a5a00">{pr_url}</a></p>'
        if pr_url
        else ""
    )
    return (
        '<!doctype html><html><body style="font-family:-apple-system,'
        "BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;"
        'padding:1.5em;color:#222;line-height:1.5">'
        f'<p style="color:#8a8a92;font-size:0.85em;margin-bottom:1em">'
        f"Week ending {run_date.isoformat()} · "
        f'<a href="{digest_blob_url}" style="color:#8a8a92">View on GitHub</a></p>'
        f"{rendered}"
        f"{pr_block}"
        '<hr style="border:none;border-top:1px solid #eee;margin-top:2em">'
        '<p style="color:#aaa;font-size:0.75em">'
        "Generated by <code>scripts/digest_week.py</code> — "
        "this is the only outbound email from iofund-agent."
        "</p>"
        "</body></html>"
    )


def send_email(
    api_key: str,
    recipient: str,
    subject: str,
    html: str,
    text: str,
) -> str:
    """POST to Resend /emails. Returns the email ID on success; raises on failure."""
    payload = {
        "from": RESEND_FROM,
        "to": [recipient],
        "subject": subject,
        "html": html,
        "text": text,
    }
    req = urllib.request.Request(
        RESEND_URL,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "iofund-agent/0.1 (https://github.com/hunterphillips/iofund-agent)",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"Resend {e.code}: {detail}") from e
    return body.get("id", "<no id>")


def main() -> int:
    load_dotenv_if_present()
    dry_run = os.environ.get("DIGEST_DRY_RUN") == "1"
    force = os.environ.get("DIGEST_FORCE_OVERWRITE") == "1"

    db_url = require_env("DATABASE_URL")
    if not dry_run:
        ai_key = require_env("AI_GATEWAY_API_KEY")
    else:
        ai_key = ""

    repo_root = Path(__file__).resolve().parent.parent
    run_date = date.today()
    start, end = window_for(run_date)

    log(f"window: {start.isoformat()} → {end.isoformat()}")

    with psycopg.connect(db_url) as conn:
        trades = fetch_week_trades(conn, start, end)
        articles = fetch_week_articles(conn, start, end)

    log(f"db: {len(trades)} trades · {len(articles)} articles")

    if not trades and not articles:
        log("skip: 0 trades + 0 articles — quiet week, nothing to email")
        return 0

    target = digest_path(repo_root, run_date)
    if target.exists() and not force:
        log(f"skip: {target} already exists (set DIGEST_FORCE_OVERWRITE=1 to redo)")
        return 0

    if dry_run:
        log(f"dry-run: would generate digest at {target}")
        log(f"dry-run: would scan thesis (agent + human docs) for staleness against {len(articles)} articles + {len(trades)} trades")
        log(f"dry-run: would email summary to {DEFAULT_RECIPIENT}")
        return 0

    log("generate: digest body via Sonnet 4.6")
    digest_body = generate_digest(ai_key, run_date, start, end, trades, articles)

    log(f"write: {target}")
    write_digest(repo_root, run_date, digest_body, force=force)

    # Commit + push the digest BEFORE staleness PR so the PR branch forks
    # off a main that already has the digest landed.
    commit_and_push_digest(repo_root, target, run_date)

    pr_url: str | None = None
    if os.environ.get("DIGEST_SKIP_PR") == "1":
        log("staleness: skipped via DIGEST_SKIP_PR=1")
    else:
        log("staleness: checking thesis drift")
        agent_path = repo_root / "data" / "io-fund-thesis.agent.md"
        agent_md = agent_path.read_text()
        proposed_agent, evidence = check_staleness(
            ai_key, run_date, agent_md, trades, articles
        )
        if proposed_agent and evidence:
            log("staleness: drift detected; updating human page from same evidence")
            human_md = (repo_root / "data" / "io-fund-thesis.md").read_text()
            proposed_human = update_human_thesis(
                ai_key, run_date, human_md, evidence, trades
            )
            log("staleness: opening PR")
            pr_url = open_thesis_pr(
                repo_root, run_date, proposed_agent, proposed_human, evidence
            )
        else:
            log("staleness: no changes needed")

    if os.environ.get("DIGEST_SKIP_EMAIL") == "1":
        log("email: skipped via DIGEST_SKIP_EMAIL=1")
        return 0

    recipient = os.environ.get("DIGEST_RECIPIENT", DEFAULT_RECIPIENT)
    resend_key = require_env("RESEND_API_KEY")

    rel = target.relative_to(repo_root).as_posix()
    blob_url = f"https://github.com/{REPO_OWNER}/{REPO_NAME}/blob/main/{rel}"

    subject = f"IOFund digest — week of {run_date.isoformat()}"
    html = render_email_html(digest_body, run_date, blob_url, pr_url)
    text = digest_body  # plain-text fallback is the raw markdown

    log(f"email: sending to {recipient}")
    email_id = send_email(resend_key, recipient, subject, html, text)
    log(f"email: sent (id={email_id})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
