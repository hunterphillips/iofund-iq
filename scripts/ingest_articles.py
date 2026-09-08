#!/usr/bin/env python3
"""Discover I/O Fund articles via the member API and persist distillations.

Idempotent: every API post is checked against the articles table by URL; only
missing ones are distilled. Non-analytical posts (webinar replays,
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
    AI_GATEWAY_API_KEY                   — Vercel AI Gateway (required when
                                           LLM_PROVIDER=gateway; optional fallback otherwise)

Optional env:
    LLM_PROVIDER           — "gateway" (default) or "claude-cli" (see scripts/llm.py)
    INGEST_MAX_PER_RUN     — int cap on new distillations per run (default unlimited)
    INGEST_MAX_PAGES       — newest API pages to scan (default 3, 100 posts each)
    INGEST_SINCE           — YYYY-MM-DD floor on pub_date (default: newest ingested − 7d)
    INGEST_DRY_RUN         — "1" skips DB writes and LLM calls; prints what would distill
"""
from __future__ import annotations

import os
import re
import sys
from datetime import date, timedelta

import psycopg
import yaml

import llm
from iof_api import IofApiError, api_get, load_dotenv_if_present, require_env, sign_in

DISTILL_MODEL = "anthropic/claude-sonnet-4-6"

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


def fetch_posts(id_token: str, max_pages: int = 3, per_page: int = 100) -> list[dict]:
    """Return the newest entitled posts, bounded for routine polling."""
    posts: list[dict] = []
    page = 1
    while page <= max_pages:
        payload = api_get(
            "/posts",
            id_token,
            {
                "post-plan": "advance",
                "per_page": per_page,
                "page": page,
                "orderby": "date",
                "order": "desc",
            },
        )
        data = payload.get("data")
        if not isinstance(data, list):
            sys.exit("ERROR: posts response missing data list")
        posts.extend(data)
        pagination = payload.get("pagination") or {}
        if not isinstance(pagination, dict) or not pagination.get("has_next"):
            break
        current = int(pagination.get("current_page") or page)
        page = current + 1
    return posts


def post_to_item(post: dict) -> dict | None:
    """Validate, filter, and normalize one member-API post."""
    if post.get("status") != "publish":
        return None
    title = post.get("title")
    slug = post.get("slug")
    relative_url = post.get("url")
    date_raw = post.get("date")
    if not all(isinstance(v, str) and v.strip() for v in (title, slug, date_raw)):
        return None
    if not isinstance(relative_url, str) or not relative_url.startswith("/"):
        return None
    try:
        pub_date = date.fromisoformat(date_raw[:10]).isoformat()
    except ValueError:
        return None
    if NON_ANALYTICAL_TITLE_RE.search(title):
        return None

    parts = [part for part in relative_url.split("/") if part]
    if not parts:
        return None
    category = parts[0]
    taxonomies = post.get("taxonomies") or {}
    post_plans = taxonomies.get("post-plan") if isinstance(taxonomies, dict) else None
    plan = None
    if isinstance(post_plans, list) and post_plans and isinstance(post_plans[0], dict):
        raw_plan = post_plans[0].get("slug")
        plan = raw_plan.strip() if isinstance(raw_plan, str) else None
    return {
        "url": f"https://io-fund.com{relative_url}",
        "title": title.strip(),
        "slug": slug.strip(),
        "pub_date": pub_date,
        "category": category,
        "premium": plan != "free",
        "plan": plan,
        "content_html": post.get("content") if isinstance(post.get("content"), str) else "",
    }


def discovery_cutoff(conn: psycopg.Connection) -> str | None:
    """Oldest pub_date (ISO) this run will distill, or None for no floor.

    The member API exposes the whole back-catalogue, so the URL diff alone
    would pull in every post ever published the first time it runs. Default
    floor is the newest already-ingested pub_date minus 7 days (late edits and
    reorderings still land); `INGEST_SINCE=YYYY-MM-DD` overrides it, e.g. for a
    deliberate historical backfill. No floor when the table is empty.
    """
    override = os.environ.get("INGEST_SINCE", "").strip()
    if override:
        return date.fromisoformat(override).isoformat()
    with conn.cursor() as cur:
        cur.execute("SELECT max(pub_date) FROM articles")
        latest = cur.fetchone()[0]
    if latest is None:
        return None
    return (latest - timedelta(days=7)).isoformat()


def existing_urls(conn: psycopg.Connection) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT url FROM articles")
        return {row[0] for row in cur.fetchall()}


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
    """Distill via the configured LLM provider; returns frontmatter + markdown."""
    return llm.call_llm(
        api_key,
        system=DISTILL_SYSTEM_PROMPT,
        user=_build_user_msg(text, item),
        model=DISTILL_MODEL,
        max_tokens=1500,
        temperature=0.2,
    )


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
    body = match.group(2).strip()
    # Models sometimes fence only the frontmatter, leaving its closing ```
    # as the body's first line — an unclosed fence that makes the whole
    # article render as a code block downstream.
    first_line, _, rest = body.partition("\n")
    if first_line and first_line.strip("`") == "":
        body = rest.lstrip("\n")
    return fm, body


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
    max_pages = int(os.environ.get("INGEST_MAX_PAGES", "3"))

    db_url = require_env("DATABASE_URL")

    user = require_env("IO_FUND_USERNAME")
    password = require_env("IO_FUND_PASSWORD")
    if not dry_run:
        ai_key = llm.require_llm_key()
    else:
        ai_key = ""

    log("auth: signing in to Firebase")
    id_token = sign_in(user, password)
    log("fetch: GET /api/v1/posts")
    try:
        raw_posts = fetch_posts(id_token, max_pages=max_pages)
    except IofApiError as exc:
        sys.exit(f"ERROR: {exc}")

    classified = [c for c in (post_to_item(p) for p in raw_posts) if c is not None]
    log(
        f"parse: {len(raw_posts)} posts · "
        f"{len(raw_posts) - len(classified)} filtered (unpublished / admin / malformed) · "
        f"{len(classified)} candidates"
    )

    with psycopg.connect(db_url) as conn:
        seen = existing_urls(conn)
        since = discovery_cutoff(conn)
        new_items = [c for c in classified if c["url"] not in seen]
        too_old = [c for c in new_items if since and c["pub_date"] < since]
        new_items = [c for c in new_items if c not in too_old]
        log(
            f"diff: {len(new_items)} new · {len(classified) - len(new_items) - len(too_old)} "
            f"already ingested · {len(too_old)} older than cutoff {since or 'none'}"
        )

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

        ok_count = 0
        fail_count = 0
        for idx, item in enumerate(new_items, 1):
            label = f"[{idx}/{len(new_items)}] {item['pub_date']} {item['slug']}"
            try:
                text = html_to_text(item["content_html"])
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
