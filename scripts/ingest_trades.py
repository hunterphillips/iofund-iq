#!/usr/bin/env python3
"""Poll IOF's /premium/trades page and upsert rows into Postgres `trades`.

Source of truth is the JSON embedded in the page's __NEXT_DATA__ script tag
(io-fund.com is a Next.js app). We extract `pageProps.notifications` — a
1k+ item list of trade alerts — and upsert each into Postgres keyed by
`iof:<notification.id>`.

Run locally:
    pip install -r scripts/requirements.txt
    python3 scripts/ingest_trades.py

Required env (loaded from .env when present, falls back to process env):
    IO_FUND_USERNAME      — IOF email (Hunter's subscription)
    IO_FUND_PASSWORD      — IOF password
    DATABASE_URL          — Neon Postgres connection string
    RESEND_API_KEY        — for sending the new-trade notification email
    RESEND_FROM_EMAIL     — sender (defaults to onboarding@resend.dev — test only)
    RESEND_TO_EMAIL       — recipient (defaults to hkphillips42@gmail.com)
    IOF_FIREBASE_API_KEY  — override (defaults to the value baked into IOF's web app)
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


def extract_notifications(html: str) -> list[dict]:
    match = NEXT_DATA_RE.search(html)
    if not match:
        sys.exit("ERROR: __NEXT_DATA__ script tag not found on trades page")
    payload = json.loads(match.group(1))
    notifications = payload.get("props", {}).get("pageProps", {}).get("notifications")
    if not isinstance(notifications, list):
        sys.exit("ERROR: pageProps.notifications missing or wrong shape")
    return notifications


def notification_to_row(item: dict) -> dict | None:
    """Map one __NEXT_DATA__ entry to a trades-table row.

    Returns None if the row is malformed.
    """
    n = item.get("notification") or {}
    user = item.get("user") or {}
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
        "analyst": user.get("name"),
    }


def upsert_rows(conn: psycopg.Connection, rows: list[dict]) -> int:
    """Bulk INSERT ... ON CONFLICT DO NOTHING. Returns count of newly-inserted rows."""
    if not rows:
        return 0
    with conn.cursor() as cur:
        # executemany returns total affected — but ON CONFLICT DO NOTHING
        # reports 0 for skipped rows, so summing per-row is correct.
        # Doing this as a single VALUES batch with RETURNING is cleaner.
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
        inserted = cur.fetchall()
    conn.commit()
    return len(inserted)


def purge_legacy_hash_ids(conn: psycopg.Connection) -> int:
    """One-shot: remove the 1,035 hash-ID rows seeded from the historical CSV
    so the live ingest can repopulate them with the correct schema (server
    IDs + Beth Technology analyst + rich stop_notes).

    Safe to run repeatedly: matches rows whose id does NOT start with 'iof:'.
    """
    with conn.cursor() as cur:
        cur.execute("DELETE FROM trades WHERE id NOT LIKE 'iof:%' RETURNING id")
        deleted = cur.fetchall()
    conn.commit()
    return len(deleted)


def send_resend_email(api_key: str, sender: str, recipient: str, subject: str, text: str) -> None:
    body = json.dumps(
        {"from": sender, "to": [recipient], "subject": subject, "text": text}
    ).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
        log("notify: resend email sent")
    except urllib.error.HTTPError as e:
        log(f"notify: resend failed ({e.code}) — {e.read().decode(errors='replace')}")


def summarize_new(rows: list[dict]) -> str:
    """Compact one-line-per-trade summary, newest first."""
    rows_sorted = sorted(rows, key=lambda r: r["trade_date"], reverse=True)
    lines = []
    for r in rows_sorted[:25]:
        price = f"${r['price']:.2f}" if r["price"] is not None else "—"
        note = f" ({r['note']})" if r.get("note") else ""
        lines.append(f"{r['trade_date']} · {r['ticker']} · {r['action']} @ {price}{note}")
    if len(rows_sorted) > 25:
        lines.append(f"...and {len(rows_sorted) - 25} more")
    return "\n".join(lines)


def main() -> int:
    load_dotenv_if_present()

    user = require_env("IO_FUND_USERNAME")
    password = require_env("IO_FUND_PASSWORD")
    db_url = require_env("DATABASE_URL")
    resend_key = os.environ.get("RESEND_API_KEY")
    resend_from = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev")
    resend_to = os.environ.get("RESEND_TO_EMAIL", "hkphillips42@gmail.com")

    log("auth: signing in to Firebase")
    id_token = sign_in(user, password)

    log("fetch: GET /premium/trades")
    html = fetch_trades_html(id_token)

    log("parse: extracting __NEXT_DATA__")
    notifications = extract_notifications(html)
    log(f"parse: {len(notifications)} notifications in payload")

    rows: list[dict] = []
    for item in notifications:
        row = notification_to_row(item)
        if row is not None:
            rows.append(row)
    log(f"parse: {len(rows)} valid rows")

    with psycopg.connect(db_url) as conn:
        purged = purge_legacy_hash_ids(conn)
        if purged:
            log(f"purge: removed {purged} legacy hash-ID rows (one-shot)")

        # Detect new rows BEFORE the upsert so the email summary lists only
        # genuinely new trades.
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM trades")
            existing_ids = {r[0] for r in cur.fetchall()}
        new_rows = [r for r in rows if r["id"] not in existing_ids]

        inserted = upsert_rows(conn, rows)

    log(f"upsert: {inserted} new rows inserted, {len(rows) - inserted} already present")

    if new_rows and resend_key:
        send_resend_email(
            api_key=resend_key,
            sender=resend_from,
            recipient=resend_to,
            subject=f"IOF trade alert · {len(new_rows)} new",
            text=summarize_new(new_rows),
        )
    elif new_rows:
        log("notify: skipping email — RESEND_API_KEY not set")
    else:
        log("notify: no new trades, no email sent")

    return 0


if __name__ == "__main__":
    sys.exit(main())
