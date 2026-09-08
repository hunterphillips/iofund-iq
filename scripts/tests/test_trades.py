"""Pure mapping tests for `/api/v1/trade-notifications` payloads."""

import json
from pathlib import Path

from ingest_trades import notification_to_row

FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "trade_notifications.json").read_text()
)["items"]


def test_notification_mapping_uses_stable_id_date_ticker_and_note():
    row = notification_to_row(FIXTURE[0], "Synthetic Analyst")
    assert row == {
        "id": "iof:501",
        "trade_date": "2026-08-01",
        "ticker": "SYN1",
        "action": "BUY",
        "price": 123.45,
        "note": "Initial synthetic entry",
        "analyst": "Synthetic Analyst",
    }


def test_alert_type_mapping_covers_all_supported_actions():
    rows = [notification_to_row(item, None) for item in FIXTURE[:4]]
    assert [row["action"] for row in rows if row] == [
        "BUY",
        "SELL",
        "HEDGE",
        "COVER-HEDGE",
    ]


def test_string_price_fallback_and_symbol_fallback():
    row = notification_to_row(FIXTURE[2], None)
    assert row is not None
    assert row["ticker"] == "HEDGE1"
    assert row["price"] == 42.75
    assert row["note"] == "Synthetic hedge"


def test_missing_prices_remain_none():
    row = notification_to_row(FIXTURE[3], None)
    assert row is not None and row["price"] is None


def test_unknown_alert_type_is_dropped():
    assert notification_to_row(FIXTURE[4], None) is None


def test_missing_required_field_is_dropped():
    assert notification_to_row({"id": 999, "alert_type": "buy"}, None) is None
