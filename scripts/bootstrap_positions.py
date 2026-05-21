#!/usr/bin/env python3
"""One-shot bootstrap of the `positions` table from a hand-edited YAML snapshot.

Reads data/positions-bootstrap.yaml (manually refreshed when Hunter downloads
a new portfolio PDF from IOF), cross-references trades.first_entry_date per
ticker, and UPSERTs into Postgres. Run manually:

    python3 scripts/bootstrap_positions.py
    python3 scripts/bootstrap_positions.py --dry-run

Idempotent — re-running with the same YAML refreshes baseline_weight_pct +
metadata, leaves first_entry_date alone (immutable once set).

Required env:
    DATABASE_URL  — Neon Postgres
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import date
from pathlib import Path

import psycopg
import yaml


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def load_dotenv_if_present() -> None:
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
            os.environ.setdefault(
                key.strip(), value.strip().strip('"').strip("'")
            )


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"ERROR: {name} is not set")
    return value


def validate_yaml(data: dict) -> None:
    """Structure check + category-sum sanity check (warns >2pp drift)."""
    if "positions" not in data:
        sys.exit("ERROR: YAML missing top-level 'positions' key")
    if "snapshot_date" not in data:
        sys.exit("ERROR: YAML missing top-level 'snapshot_date' key")
    if "categories" in data:
        actual: dict[str, float] = {}
        for p in data["positions"]:
            cat = p.get("category")
            if cat:
                actual[cat] = actual.get(cat, 0) + (p.get("weight_pct") or 0)
        for cat, declared in data["categories"].items():
            summed = actual.get(cat, 0)
            if abs(summed - declared) > 2:
                log(
                    f"WARN: category sum mismatch for {cat!r}: "
                    f"sum={summed} declared={declared} (>2pp)"
                )
            else:
                log(f"ok: category {cat!r} sums to {summed} (declared {declared})")


def first_entry_dates(
    conn: psycopg.Connection, tickers: list[str]
) -> dict[str, date]:
    """Earliest BUY date per ticker from the trades table."""
    if not tickers:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT ticker, MIN(trade_date)
            FROM trades
            WHERE action = 'BUY' AND ticker = ANY(%s)
            GROUP BY ticker
            """,
            (tickers,),
        )
        return dict(cur.fetchall())


def upsert_positions(
    conn: psycopg.Connection,
    data: dict,
    entry_dates: dict[str, date],
    snapshot_date: str,
) -> int:
    source = f"bootstrap_yaml:{snapshot_date}"
    upserted = 0
    with conn.cursor() as cur:
        for p in data["positions"]:
            ticker = p["ticker"]
            first_entry = entry_dates.get(ticker)
            cur.execute(
                """
                INSERT INTO positions
                    (ticker, company, category, status,
                     baseline_weight_pct, first_entry_date, source, updated_at)
                VALUES (%s, %s, %s, 'held', %s, %s, %s, now())
                ON CONFLICT (ticker) DO UPDATE SET
                    company = EXCLUDED.company,
                    category = EXCLUDED.category,
                    baseline_weight_pct = EXCLUDED.baseline_weight_pct,
                    first_entry_date = COALESCE(positions.first_entry_date, EXCLUDED.first_entry_date),
                    source = EXCLUDED.source,
                    updated_at = now()
                """,
                (
                    ticker,
                    p.get("company"),
                    p.get("category"),
                    p.get("weight_pct"),
                    first_entry,
                    source,
                ),
            )
            upserted += 1
    conn.commit()
    return upserted


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse + validate; skip DB queries and writes",
    )
    args = parser.parse_args()

    load_dotenv_if_present()

    repo_root = Path(__file__).resolve().parent.parent
    yaml_path = repo_root / "data" / "positions-bootstrap.yaml"
    if not yaml_path.is_file():
        sys.exit(f"ERROR: {yaml_path} not found")

    log(f"read: {yaml_path}")
    data = yaml.safe_load(yaml_path.read_text())
    validate_yaml(data)

    tickers = [p["ticker"] for p in data["positions"]]
    log(f"yaml: {len(tickers)} positions")

    if args.dry_run:
        log("dry-run: skipping DB queries + writes")
        return 0

    db_url = require_env("DATABASE_URL")
    with psycopg.connect(db_url) as conn:
        entry_dates = first_entry_dates(conn, tickers)
        log(
            f"trades: derived first_entry_date for "
            f"{len(entry_dates)}/{len(tickers)} tickers"
        )
        for t in tickers:
            if t not in entry_dates:
                log(f"  no BUY history for {t} — first_entry_date will be NULL")

        upserted = upsert_positions(
            conn, data, entry_dates, str(data["snapshot_date"])
        )
        log(f"upsert: {upserted} positions")

    return 0


if __name__ == "__main__":
    sys.exit(main())
