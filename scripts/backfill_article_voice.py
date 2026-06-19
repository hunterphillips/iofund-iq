#!/usr/bin/env python3
"""One-shot voice cleanup for already-distilled article bodies.

The article-distillation prompt in ingest_articles.py was updated (2026-06-19) to follow
WRITING.md, but the ~40 bodies already in articles.body predate that change and still carry
AI-tells / "IOF"-style shorthand. This rewrites each stored body for VOICE ONLY — preserving
every number, ticker, fact, and section heading — and writes it back. It does NOT re-fetch or
re-summarize the source (Option B in the plan), so it needs no IOF creds.

Bodies live only in Postgres (no git history), so this dumps a timestamped backup before any
write. Rewrites that fail an automated guard (dropped heading/ticker/number, residual tell) are
skipped and logged, never written.

Run locally:
    python3 scripts/backfill_article_voice.py            # rewrite + write all rows
    python3 scripts/backfill_article_voice.py --dry-run  # print a diff per article, write nothing
    python3 scripts/backfill_article_voice.py --slug <slug>   # one article
    python3 scripts/backfill_article_voice.py --limit 3       # first N by pub_date

Required env (loaded from .env when present):
    DATABASE_URL          — Neon Postgres
    AI_GATEWAY_API_KEY    — Vercel AI Gateway
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import psycopg

from ingest_articles import (
    AI_GATEWAY_URL,
    DISTILL_MODEL,
    load_dotenv_if_present,
    log,
    require_env,
)

VOICE_REWRITE_SYSTEM_PROMPT = """You rewrite an already-distilled I/O Fund article summary for VOICE ONLY.

This is not a re-summarization. Preserve every fact, number, percentage, dollar figure, ticker, and
section heading exactly. Do not add information, drop information, or reorder sections. Keep the same
markdown structure (the `## ` headings and bullet lists).

Fix only the prose voice, to plain and direct, the way Benedict Evans explains something:
- Refer to the firm as "I/O Fund" or "the fund", never the shorthand "IOF". Never call the portfolio
  "the book"; say "the portfolio" or "holdings".
- Do not name individual analysts. Attribute to the firm, not the person (e.g. "I/O Fund Portfolio
  Manager Knox Ridley" becomes "I/O Fund").
- Remove AI tells: em dashes (use a colon, comma, or period instead), business clichés ("doing the
  heavy lifting", "moving the needle"), point-announcing openers ("The throughline is...", "The
  takeaway is..."), tagline antithesis ("X; it Y"), and adjectives that sell instead of state.
- Prefer the fewest words that carry the fact.
- NEVER reproduce verbatim prose from the original article; this is paid content.

Output only the rewritten markdown body. No frontmatter, no code fences, no preamble."""


def rewrite_body(body: str, api_key: str) -> str:
    payload = {
        "model": DISTILL_MODEL,
        "temperature": 0.2,
        "max_tokens": 1500,
        "messages": [
            {"role": "system", "content": VOICE_REWRITE_SYSTEM_PROMPT},
            {"role": "user", "content": body},
        ],
    }
    req = urllib.request.Request(
        AI_GATEWAY_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"AI Gateway {e.code}: {detail}") from e
    out = data["choices"][0]["message"]["content"].strip()
    # Models sometimes wrap output in ```markdown fences — strip.
    if out.startswith("```"):
        first_nl = out.find("\n")
        out = out[first_nl + 1 :] if first_nl != -1 else out
        if out.endswith("```"):
            out = out[:-3].rstrip()
    return out.strip()


_HEADINGS_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
_NUM_RE = re.compile(r"\$?\d[\d,]*(?:\.\d+)?%?")    # 150, $25B, 1,300, 40%, 12.5


def _sig_numbers(text: str) -> set[str]:
    """Significant numbers worth protecting: $-amounts, %-values, or multi-digit figures.
    Bare single digits (Q3, top 5) and trailing punctuation are ignored — they rephrase
    freely without losing facts and otherwise cause false 'dropped number' skips."""
    out: set[str] = set()
    for tok in _NUM_RE.findall(text):
        tok = tok.rstrip(".,")
        digits = tok.lstrip("$").rstrip("%")
        if tok.startswith("$") or tok.endswith("%") or sum(c.isdigit() for c in digits) >= 2:
            out.add(tok)
    return out


def validate(old: str, new: str, tickers: list[str]) -> tuple[bool, str]:
    """Automated guards. A failure means we skip the write and leave the row untouched."""
    if len(new) < 0.6 * len(old):
        return False, f"too short ({len(new)} vs {len(old)} chars)"
    if set(_HEADINGS_RE.findall(old)) != set(_HEADINGS_RE.findall(new)):
        return False, "section headings changed"
    # Protect the row's real tickers (not generic acronyms — the rewrite is free to
    # expand "ROI"/"YTD"/"DC" into plain words). Only those present in the old body.
    dropped_tickers = [t for t in (tickers or []) if t in old and t not in new]
    if dropped_tickers:
        return False, f"dropped tickers: {dropped_tickers}"
    dropped_nums = _sig_numbers(old) - _sig_numbers(new)
    if dropped_nums:
        return False, f"dropped numbers: {sorted(dropped_nums)}"
    low = new.lower()
    string_tells = ("the book", "iof", "—", "throughline",
                    "knox ridley", "beth kindig", "royston roche", "damien robbins")
    tells = [t for t in string_tells if t in low or t in new]
    if tells:
        return False, f"residual tells: {tells}"
    return True, ""


def fetch_rows(conn, slugs: list[str] | None, limit: int | None) -> list[dict]:
    sql = "SELECT id, slug, body, tickers FROM articles WHERE body IS NOT NULL"
    params: list = []
    if slugs:
        sql += " AND slug = ANY(%s)"
        params.append(slugs)
    sql += " ORDER BY pub_date DESC NULLS LAST"
    if limit:
        sql += " LIMIT %s"
        params.append(limit)
    with conn.cursor() as cur:
        cur.execute(sql, params)
        cols = [c.name for c in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]


def backup(rows: list[dict]) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = Path(__file__).resolve().parent / f"article-bodies-backup-{stamp}.json"
    path.write_text(json.dumps(rows, indent=2, default=str))
    return path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="print a diff per article, write nothing")
    ap.add_argument("--slug", action="append", help="rewrite a specific article by slug (repeatable)")
    ap.add_argument("--limit", type=int, help="cap to the N most-recent articles")
    args = ap.parse_args()

    load_dotenv_if_present()
    db_url = require_env("DATABASE_URL")
    api_key = "" if args.dry_run else require_env("AI_GATEWAY_API_KEY")

    with psycopg.connect(db_url) as conn:
        rows = fetch_rows(conn, args.slug, args.limit)
        log(f"rows: {len(rows)} article bod{'y' if len(rows) == 1 else 'ies'} to process")
        if not rows:
            return 0

        if not args.dry_run:
            path = backup(rows)
            log(f"backup: wrote {path}")
            api_key = require_env("AI_GATEWAY_API_KEY")

        ok = skipped = 0
        for idx, row in enumerate(rows, 1):
            label = f"[{idx}/{len(rows)}] {row['slug']}"
            old = row["body"]
            try:
                if args.dry_run:
                    # Dry-run still needs a rewrite to show a diff.
                    new = rewrite_body(old, require_env("AI_GATEWAY_API_KEY"))
                else:
                    new = rewrite_body(old, api_key)
            except Exception as e:
                log(f"{label}: error — {e!r}")
                skipped += 1
                continue

            valid, reason = validate(old, new, row.get("tickers"))
            if not valid:
                log(f"{label}: skip — {reason}")
                skipped += 1
                continue

            if new == old:
                log(f"{label}: unchanged (already clean)")
                continue

            if args.dry_run:
                diff = difflib.unified_diff(
                    old.splitlines(), new.splitlines(), "old", "new", lineterm=""
                )
                log(f"{label}: would update\n" + "\n".join(diff))
                ok += 1
                continue

            with conn.cursor() as cur:
                cur.execute("UPDATE articles SET body = %s WHERE id = %s", (new, row["id"]))
            conn.commit()
            log(f"{label}: updated")
            ok += 1

        verb = "would update" if args.dry_run else "updated"
        log(f"done: {ok} {verb} · {skipped} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
