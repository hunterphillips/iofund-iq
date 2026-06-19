#!/usr/bin/env python3
"""Ingest IOF's current portfolio (company + theme + allocation %) from the
members-only portfolio PDF, and UPSERT it authoritatively into `positions`.

This automates what `bootstrap_positions.py` did manually. The IOF members
portfolio page (/premium/portfolio) embeds three Prismic-hosted PDFs; the
"Portfolio" *table* PDF (as opposed to the "Pie Chart" one) exposes per-ticker
**Allocation %**, theme, and company as real, extractable text — so we parse it
deterministically, no vision/LLM. (The pie-chart PDF's weights are a raster and
can't be extracted; that earlier limitation is why the YAML used to be
hand-curated. The table PDF lifts it.)

Flow:
    Firebase auth → GET /premium/portfolio → find the current Portfolio table
    PDF URL (Prismic, hash changes each refresh) → download → pypdf text →
    parse rows (ticker anchored to known tickers; allocation; theme) →
    validate (allocations sum ~100%) → UPSERT positions
    (company, category, baseline_weight_pct, status='held',
     source='portfolio_pdf:<run-date>').

Only fills/updates tickers present in the PDF; closes are still the trade-poll
piggyback's job. Idempotent. Run:

    python3 scripts/ingest_portfolio.py
    python3 scripts/ingest_portfolio.py --dry-run

Required env (loaded from .env / chat/.env.local when present):
    IO_FUND_USERNAME, IO_FUND_PASSWORD, DATABASE_URL
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

import psycopg
import pypdf

FIREBASE_API_KEY = os.environ.get(
    "IOF_FIREBASE_API_KEY", "AIzaSyBbWVb0wkR8tHpNezOqdU49hpgjjzzU6k0"
)
SIGNIN_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
PORTFOLIO_URL = "https://io-fund.com/premium/portfolio"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

# The three embedded PDFs end in PieChart.pdf / History.pdf / Portfolio.pdf —
# we want the table ("...-Portfolio.pdf"). The version segment (v3, v4, …) is
# matched loosely so a future IOF version bump doesn't break discovery.
TABLE_PDF_RE = re.compile(
    r'https://[^"\']*?Portfolio_v\d+-Portfolio\.pdf', re.IGNORECASE
)
DATE_RE = re.compile(r"\d{1,2}/\d{1,2}/\d{2}")
PCT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%")
# Leading alphabetic run (theme), e.g. "AI Networking" or "Semis/AI Accelerator".
THEME_LEAD_RE = re.compile(r"[A-Za-z][A-Za-z /,&.\-]*")
TYPE_SPLIT_RE = re.compile(r"Long-Term|Momentum")


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def load_dotenv_if_present() -> None:
    here = Path(__file__).resolve().parent
    for d in (here, here.parent):
        for name in (".env", "chat/.env.local"):
            env_path = d / name
            if not env_path.is_file():
                continue
            for line in env_path.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                os.environ.setdefault(
                    key.strip(), value.strip().strip('"').strip("'")
                )


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"ERROR: {name} is not set")
    return value


def sign_in(email: str, password: str) -> str:
    req = urllib.request.Request(
        SIGNIN_URL,
        data=json.dumps(
            {"email": email, "password": password, "returnSecureToken": True}
        ).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())["idToken"]


def find_table_pdf_url(id_token: str) -> str:
    """Scrape the current Portfolio table PDF URL off the members page.

    The Prismic URL embeds a content hash that changes every time IOF
    publishes a new portfolio, so it must be re-discovered each run.

    Retries once on a transient miss (fetch error, or a page that loads
    without the PDF link — e.g. caught mid-publish, as on 2026-06-18).
    """
    last_err = "fetch failed"
    for attempt in range(2):  # initial try + 1 retry
        if attempt:
            log(f"retry: re-fetching /premium/portfolio (attempt {attempt + 1}/2)")
            time.sleep(5)
        try:
            req = urllib.request.Request(
                PORTFOLIO_URL,
                headers={"User-Agent": UA, "Cookie": f"io_fund_session_token={id_token}"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                html = resp.read().decode("utf-8", "replace")
        except Exception as e:
            last_err = f"fetch error: {e!r}"
            continue
        match = TABLE_PDF_RE.search(html)
        if match:
            return match.group(0)
        last_err = "Portfolio table PDF URL not found on /premium/portfolio"
    sys.exit(f"ERROR: {last_err}")


def download_pdf_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    tmp = Path("/tmp/iof_portfolio.pdf")
    tmp.write_bytes(data)
    reader = pypdf.PdfReader(str(tmp))
    return "\n".join(pg.extract_text() or "" for pg in reader.pages)


def normalize_theme(raw: str) -> str | None:
    """Map IOF's free-text theme to a canonical category.

    IOF writes singular/compound themes ("AI Accelerator", "Semis/AI
    Accelerator,EV,..."); normalize to the taxonomy the rest of the app groups
    by. Keyword order matters (NVDA is "Semis/AI Accelerator…" → Accelerators).
    """
    low = raw.lower()
    if "accelerat" in low:
        return "AI Accelerators"
    if "networking" in low:
        return "AI Networking"
    if "energy" in low:
        return "AI Energy"
    if "memory" in low:
        return "AI Memory"
    if "software" in low:
        return "AI Software"
    if "semis" in low or "semiconductor" in low:
        return "AI Semis"
    if "crypto" in low:
        return "Cryptocurrency"
    seg = re.split(r"[/,]", raw)[0].strip()
    return seg or None


def parse_portfolio(text: str, known: set[str]) -> list[dict]:
    """Parse the table PDF text into [{ticker, company, weight, category}].

    Ticker is anchored to the known-ticker set (it can be glued to the company,
    e.g. "GOOGLAlphabet"). Allocation is the first percentage on the line.
    """
    rows: list[dict] = []
    for raw in text.split("\n"):
        line = raw.strip()
        if not line or line.startswith("w Company"):
            continue
        head = line.split(" ", 1)[0].upper()
        cands = [t for t in known if head.startswith(t)]
        if not cands:
            continue
        ticker = max(cands, key=len)

        pct = PCT_RE.search(line)
        weight = float(pct.group(1)) if pct else None

        # Company: between the ticker and the Type column (Long-Term/Momentum).
        after = line[len(ticker):].lstrip()
        company = TYPE_SPLIT_RE.split(after, 1)[0].strip(" ,") or None

        # Theme: leading alpha run after the first M/D/YY date.
        category = None
        d = DATE_RE.search(line)
        if d:
            tail = line[d.end():].lstrip()
            tm = THEME_LEAD_RE.match(tail)
            if tm:
                category = normalize_theme(tm.group(0).strip())

        rows.append(
            {"ticker": ticker, "company": company, "weight": weight, "category": category}
        )
    return rows


def validate(rows: list[dict]) -> None:
    """Guard against a garbled parse before we write financial data."""
    if len(rows) < 10:
        sys.exit(f"ERROR: only parsed {len(rows)} rows — refusing to write")
    total = sum(r["weight"] or 0 for r in rows)
    if not (90 <= total <= 110):
        sys.exit(f"ERROR: allocations sum to {total:.1f}% (expected ~100) — refusing")
    for r in rows:
        if r["weight"] is None or not (0 <= r["weight"] <= 100):
            sys.exit(f"ERROR: bad weight for {r['ticker']!r}: {r['weight']!r}")


def upsert_positions(conn: psycopg.Connection, rows: list[dict]) -> int:
    src = f"portfolio_pdf:{date.today().isoformat()}"
    n = 0
    with conn.cursor() as cur:
        for r in rows:
            cur.execute(
                """
                INSERT INTO positions
                    (ticker, company, category, status, baseline_weight_pct,
                     source, updated_at)
                VALUES (%s, %s, %s, 'held', %s, %s, now())
                ON CONFLICT (ticker) DO UPDATE SET
                    company = EXCLUDED.company,
                    category = EXCLUDED.category,
                    baseline_weight_pct = EXCLUDED.baseline_weight_pct,
                    status = 'held',
                    source = EXCLUDED.source,
                    updated_at = now()
                """,
                (r["ticker"], r["company"], r["category"], r["weight"], src),
            )
            n += 1
    conn.commit()
    return n


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run", action="store_true", help="Parse + validate; skip DB writes"
    )
    args = parser.parse_args()

    load_dotenv_if_present()
    user = require_env("IO_FUND_USERNAME")
    password = require_env("IO_FUND_PASSWORD")
    db_url = require_env("DATABASE_URL")

    log("auth: signing in to Firebase")
    id_token = sign_in(user, password)

    log("fetch: locating Portfolio table PDF")
    pdf_url = find_table_pdf_url(id_token)
    log(f"fetch: {pdf_url}")
    text = download_pdf_text(pdf_url)

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT ticker FROM trades")
            known = {row[0].upper() for row in cur.fetchall()}

        rows = parse_portfolio(text, known)
        validate(rows)
        total = sum(r["weight"] for r in rows)
        log(f"parse: {len(rows)} positions · allocations sum {total:.1f}%")
        for r in rows:
            log(
                f"  {r['ticker']:<6} {str(r['weight'])+'%':<7} "
                f"{r['category'] or '—':<16} {r['company'] or '—'}"
            )

        if args.dry_run:
            log("dry-run: no DB writes")
            return 0

        n = upsert_positions(conn, rows)
        log(f"upsert: {n} positions written (source=portfolio_pdf:{date.today()})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
