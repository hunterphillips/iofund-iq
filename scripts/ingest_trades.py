#!/usr/bin/env python3
"""Poll I/O Fund's member API and upsert trade notifications into Postgres.

The Firebase idToken is sent directly as a bearer token to
`/api/v1/trade-notifications`; no browser session or device registration is
created. Stable upstream IDs are stored as `iof:<notification.id>`.

Run locally:
    pip install -r scripts/requirements.txt
    python3 scripts/ingest_trades.py
    python3 scripts/ingest_trades.py --dry-run

Required env (loaded from .env when present, falls back to process env):
    IO_FUND_USERNAME      — IOF email (the operator's IOF subscription)
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

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import psycopg

import llm
from iof_api import IofApiError, UA, api_get, load_dotenv_if_present, require_env, sign_in

POSITION_CLOSE_RE = re.compile(r"close|stop hit", re.IGNORECASE)
POSITION_TRIM_RE = re.compile(r"trim|half", re.IGNORECASE)

ANALYST_NAME = os.environ.get("IOF_ANALYST_NAME", "Knox Ridley")
ALERT_TYPE_TO_ACTION = {
    "buy": "BUY",
    "sell": "SELL",
    "hedge": "HEDGE",
    "cover_hedge": "COVER-HEDGE",
}

# --- Position metadata enrichment --------------------------------------------
# New tickers that IOF buys after the last positions-bootstrap.yaml snapshot are
# created here by the trade-replay piggyback with no company / category / weight
# (a trade record doesn't carry them). Enrichment fills the two that ARE
# auto-derivable: company name from Yahoo (deterministic) and investment theme
# from the LLM (an inference — marked provisional via source='trade_replay+
# enriched'). Weight is NOT auto-derivable — it lives only in IOF's published
# pie chart — so it stays NULL until the authoritative bootstrap refresh, which
# overwrites company/category/weight + source and clears the provisional mark.
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
YAHOO_TICKER_REMAP = {"BTCUSD": "BTC-USD", "ETHUSD": "ETH-USD", "LINKUSD": "LINK-USD"}
CLASSIFY_MODEL = "anthropic/claude-sonnet-4-6"
# Mirrors the themes in data/positions-bootstrap.yaml; "Other" is the fallback.
POSITION_THEMES = [
    "AI Accelerators",
    "AI Memory",
    "AI Networking",
    "AI Energy",
    "AI Software",
    "Cryptocurrency",
    "Other",
]

def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def _notification_data(payload: dict) -> list[dict]:
    # The live API returns the page under `items`; accept `data` too in case
    # the backend ever aligns it with the `/posts` envelope.
    data = payload.get("items")
    if not isinstance(data, list):
        data = payload.get("data")
    if not isinstance(data, list):
        sys.exit("ERROR: trade-notifications response missing items list")
    return data


def fetch_notifications(id_token: str) -> list[dict]:
    """Fetch all trade notifications, expanding pagination if necessary."""
    first = api_get("/trade-notifications", id_token)
    data = _notification_data(first)
    pagination = first.get("pagination") or {}
    if not isinstance(pagination, dict) or int(pagination.get("total_pages") or 1) <= 1:
        return data

    notifications: list[dict] = []
    page = 1
    while True:
        payload = api_get(
            "/trade-notifications",
            id_token,
            {"page": page, "per_page": 500},
        )
        notifications.extend(_notification_data(payload))
        current = int((payload.get("pagination") or {}).get("current_page") or page)
        total = int((payload.get("pagination") or {}).get("total_pages") or current)
        if current >= total:
            break
        page = current + 1
    return notifications


def notification_to_row(item: dict, analyst: str | None) -> dict | None:
    """Map one member-API notification to a trades-table row.

    Returns None if the row is malformed.
    """
    nid = item.get("id")
    created_at = item.get("created_at")
    ticker = item.get("stock_ticker") or item.get("stock_symbol")
    alert_type = item.get("alert_type")
    if nid is None or not isinstance(created_at, str) or not ticker or not alert_type:
        return None

    action = ALERT_TYPE_TO_ACTION.get(str(alert_type).strip().lower())
    if action is None:
        log(f"parse: unknown alert_type {alert_type!r} for notification {nid!r}; skipping")
        return None

    # `created_at` is ISO 8601 UTC ("2026-05-18T16:42:16.000000Z").
    trade_date = created_at[:10]

    # `price` is integer cents (int); divide for dollars. Some early test
    # rows had price 0 — keep them rather than dropping.
    raw_price = item.get("stock_price")
    price = None
    if isinstance(raw_price, (int, float)) and not isinstance(raw_price, bool):
        price = raw_price / 100
    else:
        try:
            fallback = item.get("price")
            price = float(fallback) if fallback not in (None, "") else None
        except (TypeError, ValueError):
            price = None

    return {
        "id": f"iof:{nid}",
        "trade_date": trade_date,
        "ticker": str(ticker).strip().upper(),
        "action": action,
        "price": price,
        "note": item.get("stop_notes") or item.get("note"),
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


def fetch_company_name(ticker: str) -> str | None:
    """Yahoo Finance chart-endpoint `meta.longName` (no API key, no auth).

    Same unauthenticated endpoint chat/lib/portfolio/prices.ts uses for quotes;
    its `meta` block carries the company name too. Returns None on any failure
    so a single bad ticker never blocks the rest.
    """
    symbol = YAHOO_TICKER_REMAP.get(ticker.upper(), ticker)
    url = f"{YAHOO_CHART_URL}/{urllib.parse.quote(symbol)}?interval=1d&range=1d"
    for attempt in range(2):  # one retry on transient 429 rate-limiting
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=15) as resp:
                meta = json.loads(resp.read())["chart"]["result"][0]["meta"]
            name = meta.get("longName") or meta.get("shortName")
            return name.strip() if isinstance(name, str) and name.strip() else None
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt == 0:
                time.sleep(2)
                continue
            log(f"enrich: company lookup failed for {ticker!r}: {exc!r}")
            return None
        except Exception as exc:  # noqa: BLE001 — best-effort, never fatal
            log(f"enrich: company lookup failed for {ticker!r}: {exc!r}")
            return None
    return None


def classify_themes(
    named: list[tuple[str, str | None]], ai_key: str
) -> dict[str, str]:
    """LLM-classify tickers into IOF themes. Returns {ticker: theme}.

    `named` is (ticker, company_or_None). One batched AI Gateway call for all
    tickers. Any ticker the model omits or labels off-taxonomy is dropped (the
    caller leaves those category=NULL rather than guessing).
    """
    if not named:
        return {}
    listing = "\n".join(f"{t} — {c or '?'}" for t, c in named)
    system = (
        "You classify US-listed tickers into one of I/O Fund's investment "
        "themes (a tech-growth fund focused on the AI buildout). Themes: "
        f"{', '.join(POSITION_THEMES)}. Choose the single best fit; use "
        "'Other' only if none apply. Respond with ONLY a JSON object mapping "
        "each ticker to its theme, no prose."
    )
    content = llm.call_llm(
        ai_key,
        system=system,
        user=listing,
        model=CLASSIFY_MODEL,
        max_tokens=400,
        temperature=0,
    )
    # Models sometimes wrap JSON in ```json fences — strip to the outer braces.
    start, end = content.find("{"), content.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"classifier returned no JSON object: {content!r}")
    raw = json.loads(content[start : end + 1])
    valid = set(POSITION_THEMES)
    out: dict[str, str] = {}
    for ticker, theme in raw.items():
        if isinstance(theme, str) and theme in valid:
            out[ticker.upper()] = theme
        else:
            log(f"enrich: dropping off-taxonomy theme {theme!r} for {ticker!r}")
    return out


def enrich_positions(conn: psycopg.Connection, ai_key: str | None) -> int:
    """Fill company + category on held positions that are missing them.

    Only ever fills NULLs (COALESCE) so authoritative bootstrap values are
    never clobbered. Company comes from Yahoo; category from the LLM (skipped
    when ai_key is absent — company-only enrichment still runs). Returns the
    number of rows updated. Idempotent: a fully-enriched book matches no rows.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT ticker, company, category FROM positions
            WHERE status = 'held' AND (company IS NULL OR category IS NULL)
            ORDER BY ticker
            """
        )
        pending = cur.fetchall()
    if not pending:
        return 0
    log(f"enrich: {len(pending)} held position(s) missing metadata")

    # Company names (for the missing-company rows; also context for the
    # classifier on missing-category rows).
    names: dict[str, str] = {}
    for i, (ticker, company, _category) in enumerate(pending):
        if company:
            names[ticker] = company
            continue
        if i:
            time.sleep(0.4)  # be polite to Yahoo's unauthenticated endpoint
        names[ticker] = fetch_company_name(ticker) or ""

    # Themes for the missing-category rows, in one batched call.
    themes: dict[str, str] = {}
    needs_theme = [(t, names.get(t) or None) for t, _c, cat in pending if not cat]
    if needs_theme:
        if llm.llm_available():
            try:
                themes = classify_themes(needs_theme, ai_key or "")
            except Exception as exc:  # noqa: BLE001 — never fatal to the poll
                log(f"enrich: theme classification failed: {exc!r}")
        else:
            log("enrich: no LLM provider configured — skipping theme classification")

    updated = 0
    with conn.cursor() as cur:
        for ticker, company, category in pending:
            new_company = company or (names.get(ticker) or None)
            new_category = category or themes.get(ticker)
            if not new_company and not new_category:
                continue
            cur.execute(
                """
                UPDATE positions
                SET company = COALESCE(company, %s),
                    category = COALESCE(category, %s),
                    source = CASE WHEN source = 'trade_replay'
                                  THEN 'trade_replay+enriched' ELSE source END,
                    updated_at = now()
                WHERE ticker = %s AND status = 'held'
                """,
                (new_company, new_category, ticker),
            )
            updated += cur.rowcount
            log(
                f"enrich: {ticker} → company={new_company!r} "
                f"category={new_category!r}"
            )
    conn.commit()
    return updated


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
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run", action="store_true", help="Fetch + parse; skip DB writes"
    )
    args = parser.parse_args()

    load_dotenv_if_present()

    user = require_env("IO_FUND_USERNAME")
    password = require_env("IO_FUND_PASSWORD")
    # Optional: enables LLM theme classification during enrichment. Absent →
    # company-only enrichment still runs (graceful degradation).
    ai_key = os.environ.get("AI_GATEWAY_API_KEY")

    log("auth: signing in to Firebase")
    id_token = sign_in(user, password)

    log("fetch: GET /api/v1/trade-notifications")
    try:
        notifications = fetch_notifications(id_token)
    except IofApiError as exc:
        sys.exit(f"ERROR: {exc}")
    analyst = os.environ.get("IOF_ANALYST_NAME", ANALYST_NAME)
    log(f"parse: {len(notifications)} notifications · analyst={analyst!r}")

    rows: list[dict] = []
    for item in notifications:
        row = notification_to_row(item, analyst)
        if row is not None:
            rows.append(row)
    log(f"parse: {len(rows)} valid rows")

    if args.dry_run:
        log("dry-run: no DB writes")
        return 0

    db_url = require_env("DATABASE_URL")

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

        # Backfill company + theme on any held position still missing them
        # (new tickers from this or prior runs). Best-effort: never fatal.
        try:
            enriched = enrich_positions(conn, ai_key)
            if enriched:
                log(f"enrich: filled metadata on {enriched} position(s)")
        except Exception as exc:
            log(f"enrich: failed (non-fatal): {exc!r}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
