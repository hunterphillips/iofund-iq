#!/usr/bin/env python3
"""Discover new IOF articles via RSS, distill via AI Gateway, persist to Postgres.

Idempotent: every RSS item is checked against the articles table by URL; only
missing ones are fetched + distilled. Non-analytical posts (webinar replays,
invitations, and "no webinar" scheduling notices) are filtered two ways: a cheap
title regex at discovery time (before any LLM spend) and an LLM catch-all that
emits SKIP for administrative content the title filter misses. The distilled body
is stored frontmatter-stripped in articles.body (FTS-indexed via body_tsv) and
rendered live by the app — no git file is written, so distilled_path stays NULL
on new rows. (Legacy rows may still carry a distilled_path pointing at a committed
data/articles/*.md; nothing reads it anymore.)

First task to spend LLM credits via the Vercel AI Gateway. Per-article cost at
Sonnet 4.6 is ~$0.04-0.06.

Run locally:
    pip install -r scripts/requirements.txt
    python3 scripts/ingest_articles.py

Required env (loaded from .env when present, falls back to process env):
    IO_FUND_USERNAME, IO_FUND_PASSWORD  — IOF subscription creds
    DATABASE_URL                         — Neon Postgres
    AI_GATEWAY_API_KEY                   — Vercel AI Gateway

Optional env:
    INGEST_MAX_PER_RUN     — int cap on new distillations per run (default unlimited)
    INGEST_DRY_RUN         — "1" skips DB writes and LLM calls; prints what would distill
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

import psycopg
import yaml

FIREBASE_API_KEY = os.environ.get(
    "IOF_FIREBASE_API_KEY", "AIzaSyBbWVb0wkR8tHpNezOqdU49hpgjjzzU6k0"
)
SIGNIN_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
RSS_URL = "https://io-fund.com/rss.xml"
AI_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions"
DISTILL_MODEL = "anthropic/claude-sonnet-4-6"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

# Administrative / non-analytical posts, skipped at discovery (free, before any
# LLM spend): webinar replays, invitations, and scheduling notices like "No
# Webinar This Week" — none carry an investment thesis. The LLM catch-all below
# (SKIP sentinel) covers any non-analytical post this title filter misses.
NON_ANALYTICAL_TITLE_RE = re.compile(
    r"webinar\s+(?:replay|invitation|invite)"
    r"|\bno\s+webinar\b"
    r"|webinar\b.*\b(?:cancel|postpon|reschedul)"
    r"|\b(?:cancel|postpon|reschedul)\w*\b.*\bwebinar\b",
    re.IGNORECASE,
)

# The model is told (system prompt rule 7) to emit a bare `SKIP: <reason>` line
# for administrative / non-analytical articles instead of a distillation.
SKIP_RESPONSE_RE = re.compile(r"^\s*(?:```\w*\s*\n?)?SKIP\b", re.IGNORECASE)

DISTILL_SYSTEM_PROMPT = """You distill a single I/O Fund (io-fund.com) research article into a transformative summary for a personal AI assistant.

RULES
1. NEVER reproduce verbatim prose from the article. Paraphrase strictly. The article is paid subscription content; quoting violates the licensing terms.
2. Capture the analyst's thesis, the key numbers they cite, the decision-relevant takeaways, and any risks or watch-fors they flag.
3. Preserve specific numbers when material (revenue percentages, growth rates, dollar figures, ratios). Round to 2-3 significant figures.
4. Output VALID YAML frontmatter followed by structured markdown sections. The frontmatter MUST parse as YAML.
5. YAML string quoting: wrap url and title in double quotes ALWAYS. If the title contains a literal double quote, escape it as \\". This prevents colons inside titles from breaking YAML.
6. Be terse. 200-400 words total is the target.
7. If the piece is NOT analytical research — i.e. it is an administrative or scheduling notice (e.g. "No Webinar This Week"), a webinar invitation or replay announcement, a pure promotional notice, or otherwise presents no investment thesis, numbers, or analysis — DO NOT distill it. Output exactly one line and nothing else (no frontmatter, no sections):
SKIP: <brief reason>
Only do this when there is genuinely no investment analysis; when in doubt, distill.
8. VOICE: plain and direct, the way Benedict Evans explains something. Refer to the firm as "I/O Fund" or "the fund", never "IOF". Avoid em dashes (use a colon, comma, or period), business clichés ("doing the heavy lifting"), point-announcing openers ("The throughline is..."), and adjectives that sell rather than state. Fewest words that carry the fact.

OUTPUT FORMAT (exactly, including the quotes):
---
url: "<the url provided>"
title: "<the title provided>"
pub_date: <the pub_date provided, YYYY-MM-DD>
category: <the category provided>
tickers: [TICKER1, TICKER2]
---

## Thesis
2-3 sentence paraphrased thesis.

## Key numbers
- Specific metric: value (context)
- Specific metric: value (context)

## Decision-relevant takeaways
- Takeaway 1.
- Takeaway 2.

## Risks / watch-fors
- Risk 1.
- Risk 2."""


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


def sign_in(email: str, password: str) -> str:
    """Returns a fresh Firebase idToken."""
    req = urllib.request.Request(
        SIGNIN_URL,
        data=json.dumps(
            {"email": email, "password": password, "returnSecureToken": True}
        ).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = json.loads(resp.read())
    return body["idToken"]


def fetch_rss() -> bytes:
    req = urllib.request.Request(RSS_URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def parse_rss(xml_bytes: bytes) -> list[dict]:
    """Returns a list of raw RSS items (url, title, pub_date, guid)."""
    root = ET.fromstring(xml_bytes)
    items: list[dict] = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        guid = (it.findtext("guid") or "").strip()
        pub_raw = it.findtext("pubDate") or ""
        try:
            pub_date = parsedate_to_datetime(pub_raw).date().isoformat()
        except (TypeError, ValueError):
            pub_date = ""
        if not (title and link and pub_date):
            continue
        items.append({"title": title, "url": link, "guid": guid, "pub_date": pub_date})
    return items


def classify_item(item: dict) -> dict | None:
    """Enrich + filter. Returns dict with {url, title, slug, pub_date, category, premium}
    or None if the item should be skipped (e.g. webinar / administrative notice).
    """
    if NON_ANALYTICAL_TITLE_RE.search(item["title"]):
        return None
    parsed = urlparse(item["url"])
    parts = [p for p in parsed.path.split("/") if p]
    if not parts:
        return None
    category = parts[0]
    slug = parts[-1]
    return {
        "url": item["url"],
        "title": item["title"],
        "slug": slug,
        "pub_date": item["pub_date"],
        "category": category,
        "premium": category == "premium",
    }


def existing_urls(conn: psycopg.Connection) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT url FROM articles")
        return {row[0] for row in cur.fetchall()}


def fetch_article_html(url: str, id_token: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Cookie": f"io_fund_session_token={id_token}",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


# HTML → plain-text extractor (ported from .claude/skills/iofund-fetch/fetch.py).
from html.parser import HTMLParser


class _TextExtractor(HTMLParser):
    BLOCK = {"p", "h1", "h2", "h3", "h4", "h5", "li", "br", "div", "tr"}
    DROP = {"script", "style", "nav", "footer", "header", "aside", "form", "noscript"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.DROP:
            self.skip += 1
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.DROP and self.skip:
            self.skip -= 1

    def handle_data(self, d):
        if not self.skip:
            self.parts.append(d)


def html_to_text(html: str) -> str:
    html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
    p = _TextExtractor()
    p.feed(html)
    text = "".join(p.parts)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def _build_user_msg(text: str, item: dict) -> str:
    return (
        f"URL: {item['url']}\n"
        f"TITLE: {item['title']}\n"
        f"PUB_DATE: {item['pub_date']}\n"
        f"CATEGORY: {item['category']}\n"
        "\n---\n\n"
        f"{text}"
    )


def distill_article(text: str, item: dict, api_key: str) -> str:
    """POST to AI Gateway, return the model's raw output (frontmatter + markdown)."""
    payload = {
        "model": DISTILL_MODEL,
        "temperature": 0.2,
        "max_tokens": 1500,
        "messages": [
            {"role": "system", "content": DISTILL_SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_msg(text, item)},
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
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"AI Gateway {e.code}: {detail}") from e
    return body["choices"][0]["message"]["content"]


FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)\Z", re.DOTALL)


def parse_frontmatter(md: str) -> tuple[dict, str]:
    """Split YAML frontmatter + body. Raises ValueError on malformed input."""
    md = md.strip()
    # Models sometimes wrap output in ```markdown fences — strip.
    if md.startswith("```"):
        first_nl = md.find("\n")
        md = md[first_nl + 1 :] if first_nl != -1 else md
        if md.endswith("```"):
            md = md[:-3].rstrip()
    match = FRONTMATTER_RE.match(md)
    if not match:
        raise ValueError("no frontmatter delimiters found")
    fm = yaml.safe_load(match.group(1)) or {}
    if not isinstance(fm, dict):
        raise ValueError(f"frontmatter is not a mapping: {type(fm).__name__}")
    return fm, match.group(2).strip()


def validate_distillation(fm: dict, body: str, item: dict) -> tuple[bool, str]:
    required = {"url", "title", "pub_date", "category", "tickers"}
    missing = required - set(fm.keys())
    if missing:
        return False, f"missing frontmatter keys: {sorted(missing)}"
    if fm.get("url") != item["url"]:
        return False, f"url mismatch: fm={fm.get('url')!r} item={item['url']!r}"
    if not isinstance(fm.get("tickers"), list):
        return False, f"tickers not a list: {type(fm.get('tickers')).__name__}"
    if len(body) < 100:
        return False, f"body too short ({len(body)} chars)"
    return True, ""


def normalize_tickers(raw) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for t in raw:
        if not isinstance(t, str):
            continue
        t = t.strip().upper()
        if not t or t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out[:10]


def insert_article_row(
    conn: psycopg.Connection,
    item: dict,
    distilled_path: str | None,
    tickers: list[str],
    body: str,
) -> bool:
    """Returns True if a new row was inserted, False on conflict."""
    article_id = f"iof-article:{item['slug']}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO articles
                (id, url, pub_date, title, slug, premium, category, tickers, distilled_path, body)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (url) DO NOTHING
            RETURNING id
            """,
            (
                article_id,
                item["url"],
                item["pub_date"],
                item["title"],
                item["slug"],
                item["premium"],
                item["category"],
                tickers,
                distilled_path,
                body,
            ),
        )
        row = cur.fetchone()
    conn.commit()
    return row is not None


def main() -> int:
    load_dotenv_if_present()

    dry_run = os.environ.get("INGEST_DRY_RUN") == "1"
    max_per_run_raw = os.environ.get("INGEST_MAX_PER_RUN", "").strip()
    max_per_run = int(max_per_run_raw) if max_per_run_raw else None

    db_url = require_env("DATABASE_URL")

    user = require_env("IO_FUND_USERNAME")
    password = require_env("IO_FUND_PASSWORD")
    if not dry_run:
        ai_key = require_env("AI_GATEWAY_API_KEY")
    else:
        ai_key = ""

    log("fetch: GET /rss.xml")
    xml_bytes = fetch_rss()

    log("parse: RSS items")
    raw_items = parse_rss(xml_bytes)
    classified = [c for c in (classify_item(i) for i in raw_items) if c is not None]
    log(
        f"parse: {len(raw_items)} items · "
        f"{len(raw_items) - len(classified)} filtered (webinar / admin notices / no path) · "
        f"{len(classified)} candidates"
    )

    with psycopg.connect(db_url) as conn:
        seen = existing_urls(conn)
        new_items = [c for c in classified if c["url"] not in seen]
        log(f"diff: {len(new_items)} new · {len(classified) - len(new_items)} already ingested")

        if max_per_run is not None and len(new_items) > max_per_run:
            log(f"cap: trimming to most-recent {max_per_run} of {len(new_items)}")
            new_items.sort(key=lambda c: c["pub_date"], reverse=True)
            new_items = new_items[:max_per_run]

        if dry_run:
            for item in new_items:
                log(f"dry-run would distill: {item['pub_date']} · {item['slug']}")
            log(f"dry-run: would distill {len(new_items)} article(s)")
            return 0

        if not new_items:
            return 0

        log("auth: signing in to Firebase")
        id_token = sign_in(user, password)

        ok_count = 0
        fail_count = 0
        for idx, item in enumerate(new_items, 1):
            label = f"[{idx}/{len(new_items)}] {item['pub_date']} {item['slug']}"
            try:
                log(f"{label}: fetch")
                html = fetch_article_html(item["url"], id_token)
                text = html_to_text(html)
                if len(text) < 500:
                    log(f"{label}: skip — body too short ({len(text)} chars)")
                    fail_count += 1
                    continue

                log(f"{label}: distill")
                distilled_md = distill_article(text, item, ai_key)
                if SKIP_RESPONSE_RE.match(distilled_md.strip()):
                    log(f"{label}: skip — non-analytical ({distilled_md.strip()[:80]})")
                    fail_count += 1
                    continue
                fm, body = parse_frontmatter(distilled_md)
                ok, reason = validate_distillation(fm, body, item)
                if not ok:
                    log(f"{label}: skip — {reason}")
                    fail_count += 1
                    continue

                tickers = normalize_tickers(fm.get("tickers"))
                # Body lives only in Postgres now (articles.body, FTS-indexed and
                # rendered live by the app). No git file, so distilled_path is NULL.
                inserted = insert_article_row(conn, item, None, tickers, body)
                if not inserted:
                    log(f"{label}: row conflict (already inserted by concurrent run)")
                else:
                    log(f"{label}: ok → {item['slug']} · tickers={tickers}")
                    ok_count += 1
            except Exception as e:
                log(f"{label}: error — {e!r}")
                fail_count += 1
                continue

        log(f"done: {ok_count} ingested · {fail_count} failed/skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
