#!/usr/bin/env python3
"""Ingest I/O Fund's current portfolio from the member API.

The Firebase idToken is sent directly as a bearer token to
`/api/v1/portfolio?name=Advance-Portfolio`. The returned Sheets-backed JSON is
classified into positions, continuation rows, and unresolved new positions.
Blank-ticker newcomers are matched to same-date/same-price BUY trades before
the book is validated and written authoritatively to `positions` with
`source='portfolio_api:<run-date>'`.

The API table is authoritative in both directions: listed tickers are upserted
as held, while held positions previously claimed by an authoritative source
but absent from the current table are closed. Trade-replay-born rows remain
exempt because a new alert can legitimately precede its table appearance.

Run:
    python3 scripts/ingest_portfolio.py
    python3 scripts/ingest_portfolio.py --dry-run

Required env (loaded from scripts/.env, .env, or chat/.env.local):
    IO_FUND_USERNAME, IO_FUND_PASSWORD, DATABASE_URL
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

import psycopg

from iof_api import IofApiError, api_get, load_dotenv_if_present, require_env, sign_in

SHEET_NAME = os.environ.get("IOF_PORTFOLIO_SHEET", "Advance-Portfolio")
TICKER_TOKEN_RE = re.compile(r"[A-Z0-9.\-]+")

# First match wins. Accelerator must beat compound labels containing "Semis";
# the specific equipment label precedes the broader semiconductor fallbacks.
THEME_KEYWORDS = [
    ("accelerat", "AI Accelerators"),
    ("semi equipment", "AI Semis"),
    ("networking", "AI Networking"),
    ("energy", "AI Energy"),
    ("memory", "AI Memory"),
    ("software", "AI Software"),
    ("semis", "AI Semis"),
    ("semiconductor", "AI Semis"),
    ("crypto", "Cryptocurrency"),
    ("semi", "AI Semis"),
]


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def clean(value: object) -> str:
    """Normalize a sheet cell; unresolved formula markers count as blank."""
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text.upper() == "#N/A" else text


def pct(value: object) -> float | None:
    """Parse a sheet allocation such as `8.3%`; blank/bad cells stay unsized."""
    text = clean(value)
    if not text:
        return None
    if text.endswith("%"):
        text = text[:-1].strip()
    try:
        return float(text.replace(",", ""))
    except ValueError:
        return None


def parse_entry_date(value: object) -> date | None:
    text = clean(value)
    if not text:
        return None
    try:
        return datetime.strptime(text, "%m/%d/%y").date()
    except ValueError:
        return None


def parse_entry_price(value: object) -> Decimal | None:
    text = clean(value)
    if not text:
        return None
    try:
        return Decimal(text.replace("$", "").replace(",", "").strip())
    except InvalidOperation:
        return None


def normalize_theme(raw: str) -> str | None:
    """Map I/O Fund's free-text microtrend to the app's category taxonomy."""
    low = raw.lower()
    for keyword, category in THEME_KEYWORDS:
        if keyword in low:
            return category
    segment = re.split(r"[/,]", raw)[0].strip()
    return segment or None


def fetch_sheet_rows(id_token: str) -> list[dict]:
    """Fetch and validate the configured member portfolio table."""
    sheet_name = os.environ.get("IOF_PORTFOLIO_SHEET", SHEET_NAME)
    try:
        payload = api_get("/portfolio", id_token, {"name": sheet_name})
    except IofApiError as exc:
        if exc.status == 403:
            sys.exit(f"ERROR: portfolio access denied: {exc.message}")
        raise
    data = payload.get("data")
    if payload.get("success") is not True or not isinstance(data, list):
        message = payload.get("error") or payload.get("message") or "unexpected response"
        sys.exit(f"ERROR: portfolio API failed: {message}")
    return data


def parse_sheet(
    rows: list[dict], known_tickers: set[str]
) -> tuple[list[dict], list[dict]]:
    """Classify decoded sheet rows into known positions and blank-ticker buys."""
    known = {
        ticker.strip().upper()
        for ticker in known_tickers
        if isinstance(ticker, str) and TICKER_TOKEN_RE.fullmatch(ticker.strip().upper())
    }
    positions: list[dict] = []
    unresolved: list[dict] = []

    for index, row in enumerate(rows, 1):
        if not isinstance(row, dict):
            log(f"parse: skipping non-object sheet row {index}")
            continue
        ticker = clean(row.get("ticker")).upper()
        allocation = clean(row.get("allocation"))
        first_entry = clean(row.get("first_entry"))
        category = normalize_theme(clean(row.get("microtrend")))
        parsed = {
            "company": clean(row.get("company")) or None,
            "weight": pct(allocation),
            "category": category,
            "first_entry": first_entry or None,
            "date_of_entry": clean(row.get("date_of_entry")) or None,
        }

        if ticker:
            if not TICKER_TOKEN_RE.fullmatch(ticker) or ticker not in known:
                log(f"parse: skipping unrecognized ticker {ticker!r} on row {index}")
                continue
            positions.append({"ticker": ticker, **parsed})
            continue

        if not allocation and not first_entry:
            # Continuation rows only carry a later entry/gain/date for the
            # preceding ticker. Those columns are outside this ingest's scope.
            continue

        unresolved.append(parsed)

    return positions, unresolved


def resolve_unresolved(conn: psycopg.Connection, rows: list[dict]) -> list[dict]:
    """Resolve blank-ticker sheet rows against a unique same-day BUY trade."""
    resolved: list[dict] = []
    for row in rows:
        entry_date = parse_entry_date(row.get("date_of_entry"))
        entry_price = parse_entry_price(row.get("first_entry"))
        if entry_date is None or entry_price is None:
            log(
                "resolve: blank-ticker row has invalid first entry/date; "
                "leaving unresolved"
            )
            continue
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ticker FROM trades
                WHERE action = 'BUY' AND trade_date = %s AND price = %s
                """,
                (entry_date, entry_price),
            )
            matches = sorted(
                {
                    match[0].strip().upper()
                    for match in cur.fetchall()
                    if isinstance(match[0], str) and match[0].strip()
                }
            )
        if len(matches) != 1:
            log(
                f"resolve: blank-ticker row matched {len(matches)} BUY trades "
                f"on {entry_date} at ${entry_price}; leaving unresolved"
            )
            continue
        ticker = matches[0]
        resolved.append({"ticker": ticker, **row})
        log(f"resolve: {ticker} matched blank-ticker row via trade on {entry_date}")
    return resolved


def validate(rows: list[dict], *, extra_weight: float = 0.0) -> None:
    """Guard against a garbled table before writing authoritative data.

    `extra_weight` accounts for unresolved rows that were deliberately dropped:
    their allocations still belong in the upstream sum check.
    """
    if len(rows) < 10:
        sys.exit(f"ERROR: only parsed {len(rows)} rows — refusing to write")
    weighted = [row for row in rows if row["weight"] is not None]
    if len(weighted) < 10:
        sys.exit(
            f"ERROR: only {len(weighted)}/{len(rows)} rows have weights — refusing"
        )
    if not (0 <= extra_weight <= 100):
        sys.exit(f"ERROR: bad unresolved allocation total: {extra_weight!r}")
    total = sum(row["weight"] for row in weighted) + extra_weight
    if not (90 <= total <= 110):
        sys.exit(f"ERROR: allocations sum to {total:.1f}% (expected ~100) — refusing")
    for row in weighted:
        if not (0 <= row["weight"] <= 100):
            sys.exit(f"ERROR: bad weight for {row['ticker']!r}: {row['weight']!r}")


def upsert_positions(conn: psycopg.Connection, rows: list[dict]) -> int:
    src = f"portfolio_api:{date.today().isoformat()}"
    written = 0
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(
                """
                INSERT INTO positions
                    (ticker, company, category, status, baseline_weight_pct,
                     source, updated_at)
                VALUES (%s, %s, %s, 'held', %s, %s, now())
                ON CONFLICT (ticker) DO UPDATE SET
                    -- A blank sheet cell (e.g. "#N/A" on a brand-new row) must not
                    -- erase a name/category the trade-poll enrichment already filled.
                    company = COALESCE(EXCLUDED.company, positions.company),
                    category = COALESCE(EXCLUDED.category, positions.category),
                    baseline_weight_pct = EXCLUDED.baseline_weight_pct,
                    status = 'held',
                    source = EXCLUDED.source,
                    updated_at = now()
                """,
                (
                    row["ticker"],
                    row["company"],
                    row["category"],
                    row["weight"],
                    src,
                ),
            )
            written += 1
    conn.commit()
    return written


def close_missing_positions(
    conn: psycopg.Connection, api_tickers: list[str], *, dry_run: bool = False
) -> list[str]:
    """Close authoritative held positions missing from the current API table."""
    where = """
        status = 'held'
          AND (source LIKE 'portfolio_api:%%'
               OR source LIKE 'portfolio_pdf:%%'
               OR source LIKE 'bootstrap_yaml:%%')
          AND NOT (ticker = ANY(%s))
    """
    with conn.cursor() as cur:
        if dry_run:
            cur.execute(f"SELECT ticker FROM positions WHERE {where}", (api_tickers,))
        else:
            cur.execute(
                f"""
                UPDATE positions
                SET status = 'closed',
                    source = %s,
                    updated_at = now()
                WHERE {where}
                RETURNING ticker
                """,
                (f"portfolio_api:{date.today().isoformat()}", api_tickers),
            )
        closed = sorted(row[0] for row in cur.fetchall())
    if not dry_run:
        conn.commit()
    return closed


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
    sheet_name = os.environ.get("IOF_PORTFOLIO_SHEET", SHEET_NAME)
    log(f"fetch: GET /api/v1/portfolio?name={sheet_name}")
    try:
        sheet_rows = fetch_sheet_rows(id_token)
    except IofApiError as exc:
        sys.exit(f"ERROR: {exc}")

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT ticker FROM trades")
            known = {
                row[0].strip().upper()
                for row in cur.fetchall()
                if isinstance(row[0], str) and row[0].strip()
            }

        positions, unresolved = parse_sheet(sheet_rows, known)
        if args.dry_run and unresolved:
            log(f"parse: {len(unresolved)} blank-ticker row(s) to resolve")
            for row in unresolved:
                weight = f"{row['weight']}%" if row["weight"] is not None else "—"
                log(
                    f"  unresolved {weight:<7} {row['category'] or '—':<16} "
                    f"entry={row['first_entry'] or '—'} date={row['date_of_entry'] or '—'}"
                )
        resolved = resolve_unresolved(conn, unresolved)
        rows = positions + resolved
        dropped_count = len(unresolved) - len(resolved)
        dropped_weight = sum(
            row["weight"] or 0.0 for row in unresolved
        ) - sum(row["weight"] or 0.0 for row in resolved)
        validate(rows, extra_weight=dropped_weight)

        total = sum(row["weight"] for row in rows if row["weight"] is not None)
        total_with_dropped = total + dropped_weight
        unsized = sum(1 for row in rows if row["weight"] is None)
        log(
            f"parse: {len(rows)} positions · allocations sum {total_with_dropped:.1f}%"
            + (f" · {unsized} unsized" if unsized else "")
            + (f" · {dropped_count} unresolved dropped" if dropped_count else "")
        )
        for row in rows:
            weight = f"{row['weight']}%" if row["weight"] is not None else "—"
            log(
                f"  {row['ticker']:<6} {weight:<7} "
                f"{row['category'] or '—':<16} {row['company'] or '—'}"
            )
        resolved_keys = {
            (row["first_entry"], row["date_of_entry"], row["weight"]) for row in resolved
        }
        for row in unresolved:
            if (row["first_entry"], row["date_of_entry"], row["weight"]) not in resolved_keys:
                log(
                    "  unresolved "
                    f"{row['weight'] if row['weight'] is not None else '—'}% "
                    f"{row['date_of_entry'] or '—'} {row['first_entry'] or '—'}"
                )

        api_tickers = [row["ticker"] for row in rows]
        if args.dry_run:
            would_close = close_missing_positions(conn, api_tickers, dry_run=True)
            if would_close:
                log(f"dry-run: would close API dropouts: {', '.join(would_close)}")
            log("dry-run: no DB writes")
            return 0

        written = upsert_positions(conn, rows)
        log(
            f"upsert: {written} positions written "
            f"(source=portfolio_api:{date.today()})"
        )
        closed = close_missing_positions(conn, api_tickers)
        if closed:
            log(f"close: {len(closed)} API dropouts closed: {', '.join(closed)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
