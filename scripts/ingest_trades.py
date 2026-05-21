#!/usr/bin/env python3
"""Poll IOF's /premium/trades page and upsert rows into Postgres `trades`.

Source of truth is the JSON embedded in the page's __NEXT_DATA__ script tag
(io-fund.com is a Next.js app). We extract `pageProps.notifications` — a
1k+ item list of trade alerts — and upsert each into Postgres keyed by
`iof:<notification.id>`. Analyst is taken from `pageProps.author.data.name`
(currently Knox Ridley — the human attribution shown next to each alert in
the IOF UI; the per-notification `user.name` is the system service account
that pushes alerts via the API and is NOT what we want).

Run locally:
    pip install -r scripts/requirements.txt
    python3 scripts/ingest_trades.py

Required env (loaded from .env when present, falls back to process env):
    IO_FUND_USERNAME      — IOF email (Hunter's subscription)
    IO_FUND_PASSWORD      — IOF password
    DATABASE_URL          — Neon Postgres connection string
    IOF_FIREBASE_API_KEY  — override (defaults to the value baked into IOF's web app)

No outbound notifications: IOF already sends users SMS + email alerts on
every trade. This script's only job is to ingest those trades into our
Postgres so the chat tools can reason over them. The Phase 1 upgrade is
to replace polling with an email→webhook trigger (IOF alert email →
forwarder → webhook → immediate ingest) — same data flow, lower latency.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import psycopg

POSITION_CLOSE_RE = re.compile(r"close|stop hit", re.IGNORECASE)
POSITION_TRIM_RE = re.compile(r"trim|half", re.IGNORECASE)

FIREBASE_API_KEY = os.environ.get(
    "IOF_FIREBASE_API_KEY", "AIzaSyBbWVb0wkR8tHpNezOqdU49hpgjjzzU6k0"
)
SIGNIN_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
TRADES_URL = "https://io-fund.com/premium/trades"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.+?)</script>',
    re.DOTALL,
)


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


def fetch_trades_html(id_token: str) -> str:
    """Fetches the /premium/trades page with a Firebase session cookie."""
    req = urllib.request.Request(
        TRADES_URL,
        headers={
            "User-Agent": UA,
            "Cookie": f"io_fund_session_token={id_token}",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def extract_page(html: str) -> tuple[list[dict], str | None]:
    """Returns (notifications, page_author_name).

    page_author_name is the human attribution shown on each row in the UI
    (currently "Knox Ridley"). Falls back to None if the author field is
    absent or shaped unexpectedly.
    """
    match = NEXT_DATA_RE.search(html)
    if not match:
        sys.exit("ERROR: __NEXT_DATA__ script tag not found on trades page")
    payload = json.loads(match.group(1))
    page_props = payload.get("props", {}).get("pageProps", {})
    notifications = page_props.get("notifications")
    if not isinstance(notifications, list):
        sys.exit("ERROR: pageProps.notifications missing or wrong shape")
    author = page_props.get("author") or {}
    analyst = (author.get("data") or {}).get("name")
    # `name` is sometimes a rich-text block — collapse if so.
    if isinstance(analyst, list):
        analyst = "".join(
            seg.get("text", "")
            for seg in analyst
            if isinstance(seg, dict)
        ).strip() or None
    return notifications, analyst


def notification_to_row(item: dict, analyst: str | None) -> dict | None:
    """Map one __NEXT_DATA__ entry to a trades-table row.

    Returns None if the row is malformed.
    """
    n = item.get("notification") or {}
    nid = n.get("id")
    created_at = n.get("created_at")
    ticker = n.get("ticker")
    action = n.get("type")
    if not (nid and created_at and ticker and action):
        return None

    # `created_at` is ISO 8601 UTC ("2026-05-18T16:42:16.000000Z").
    trade_date = created_at[:10]

    # `price` is integer cents (int); divide for dollars. Some early test
    # rows had price 0 — keep them rather than dropping.
    raw_price = n.get("price")
    price = None
    if isinstance(raw_price, (int, float)):
        price = raw_price / 100

    return {
        "id": f"iof:{nid}",
        "trade_date": trade_date,
        "ticker": ticker,
        "action": action,
        "price": price,
        "note": n.get("stop_notes"),
        "analyst": analyst,
    }


def upsert_rows(conn: psycopg.Connection, rows: list[dict]) -> list[dict]:
    """Bulk INSERT ... ON CONFLICT DO NOTHING. Returns the newly-inserted rows."""
    if not rows:
        return []
    by_id = {r["id"]: r for r in rows}
    with conn.cursor() as cur:
        values_sql = ",".join(["(%s,%s,%s,%s,%s,%s,%s)"] * len(rows))
        params: list = []
        for r in rows:
            params.extend(
                [
                    r["id"],
                    r["trade_date"],
                    r["ticker"],
                    r["action"],
                    r["price"],
                    r["note"],
                    r["analyst"],
                ]
            )
        cur.execute(
            f"""
            INSERT INTO trades (id, trade_date, ticker, action, price, note, analyst)
            VALUES {values_sql}
            ON CONFLICT (id) DO NOTHING
            RETURNING id
            """,
            params,
        )
        inserted_ids = [row[0] for row in cur.fetchall()]
    conn.commit()
    return [by_id[i] for i in inserted_ids]


def classify_trade_for_position(trade: dict) -> tuple[str, str] | None:
    """Map a trade to (new_status, last_action_type), or None to skip.

    - HEDGE / COVER-HEDGE: skip (short-ETF hedging, not real positions).
    - BUY (any note): open or add → 'held'.
    - SELL + close/stop hit note: → 'closed'.
    - SELL + trim/half note: → 'held' (sizing reduction, thesis intact).
    - SELL with neither pattern: log warning, skip.
    """
    action = trade.get("action") or ""
    note = trade.get("note") or ""

    if action in ("HEDGE", "COVER-HEDGE"):
        return None

    if action == "BUY":
        action_type = "BUY-Add" if "add" in note.lower() else "BUY"
        return ("held", action_type)

    if action == "SELL":
        if POSITION_CLOSE_RE.search(note):
            return ("closed", "SELL-Close")
        if POSITION_TRIM_RE.search(note):
            return ("held", "SELL-Trim")
        log(
            f"position: ambiguous SELL note for {trade.get('ticker')!r} "
            f"(note={note!r}); skipping"
        )
        return None

    log(f"position: unknown action {action!r} for {trade.get('ticker')!r}; skipping")
    return None


def update_position_from_trade(conn: psycopg.Connection, trade: dict) -> None:
    """Apply a single trade's state transition to the positions table."""
    classified = classify_trade_for_position(trade)
    if classified is None:
        return
    new_status, action_type = classified
    ticker = trade["ticker"]
    trade_date = trade["trade_date"]

    with conn.cursor() as cur:
        if action_type.startswith("BUY"):
            # Re-entry resets first_entry_date so it tracks the FIRST entry of
            # the CURRENT held run, not the lifetime-first entry. Matters when
            # IOF closes + re-enters a position months later.
            cur.execute(
                """
                INSERT INTO positions
                    (ticker, status, first_entry_date, last_action_date,
                     last_action_type, source, updated_at)
                VALUES (%s, 'held', %s, %s, %s, 'trade_replay', now())
                ON CONFLICT (ticker) DO UPDATE SET
                    status = 'held',
                    first_entry_date = CASE
                        WHEN positions.status = 'closed' THEN EXCLUDED.first_entry_date
                        ELSE COALESCE(positions.first_entry_date, EXCLUDED.first_entry_date)
                    END,
                    last_action_date = EXCLUDED.last_action_date,
                    last_action_type = EXCLUDED.last_action_type,
                    updated_at = now()
                """,
                (ticker, trade_date, trade_date, action_type),
            )
            log(f"position update: {ticker} → held ({action_type})")
        else:
            cur.execute(
                """
                UPDATE positions
                SET status = %s,
                    last_action_date = %s,
                    last_action_type = %s,
                    updated_at = now()
                WHERE ticker = %s
                """,
                (new_status, trade_date, action_type, ticker),
            )
            if cur.rowcount == 0:
                log(
                    f"position: SELL on unknown ticker {ticker!r}; "
                    f"skipping (bootstrap missing?)"
                )
            else:
                log(f"position update: {ticker} → {new_status} ({action_type})")
    conn.commit()


def reconcile_legacy_rows(conn: psycopg.Connection, analyst: str | None) -> tuple[int, int]:
    """Two one-shot cleanups. Both idempotent (no-op once converged).

    Returns (purged_hash_id_rows, analyst_fixed_rows).

    1. Drop hash-ID rows from the original seed-trades.ts import — they're
       replaced by `iof:<server-id>` PKs from the live source.
    2. Backfill analyst on any rows that pre-date the page-level author
       extraction (system-account values like "Beth Technology" or
       "Nate Soria"). Once cleared, future inserts already have the
       correct analyst so this matches zero rows on subsequent runs.
    """
    with conn.cursor() as cur:
        cur.execute("DELETE FROM trades WHERE id NOT LIKE 'iof:%' RETURNING id")
        purged = len(cur.fetchall())

        fixed = 0
        if analyst:
            cur.execute(
                "UPDATE trades SET analyst = %s WHERE analyst <> %s RETURNING id",
                (analyst, analyst),
            )
            fixed = len(cur.fetchall())
    conn.commit()
    return purged, fixed


def main() -> int:
    load_dotenv_if_present()

    user = require_env("IO_FUND_USERNAME")
    password = require_env("IO_FUND_PASSWORD")
    db_url = require_env("DATABASE_URL")

    log("auth: signing in to Firebase")
    id_token = sign_in(user, password)

    log("fetch: GET /premium/trades")
    html = fetch_trades_html(id_token)

    log("parse: extracting __NEXT_DATA__")
    notifications, analyst = extract_page(html)
    log(f"parse: {len(notifications)} notifications · analyst={analyst!r}")

    rows: list[dict] = []
    for item in notifications:
        row = notification_to_row(item, analyst)
        if row is not None:
            rows.append(row)
    log(f"parse: {len(rows)} valid rows")

    with psycopg.connect(db_url) as conn:
        purged, fixed = reconcile_legacy_rows(conn, analyst)
        if purged:
            log(f"reconcile: purged {purged} legacy hash-ID rows")
        if fixed:
            log(f"reconcile: backfilled analyst on {fixed} rows → {analyst!r}")
        inserted_rows = upsert_rows(conn, rows)
        log(
            f"upsert: {len(inserted_rows)} new rows · "
            f"{len(rows) - len(inserted_rows)} already present"
        )

        for trade in inserted_rows:
            try:
                update_position_from_trade(conn, trade)
            except Exception as exc:
                log(f"position update failed for {trade.get('id')!r}: {exc!r}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
