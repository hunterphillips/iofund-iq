"""Behavior tests for the trade-ingest pure logic (scripts/ingest_trades.py).

These are characterization tests over public functions — no DB, no network, no
LLM. They pin the rules that decide a position's held/closed status and the
parsing of IOF's upstream trade payload.
"""

import json

import pytest

from ingest_trades import (
    classify_trade_for_position,
    extract_page,
    notification_to_row,
)


# ── Position state machine (classify_trade_for_position) ────────────────────


def test_buy_opens_or_adds_to_held():
    assert classify_trade_for_position({"action": "BUY", "note": ""}) == (
        "held",
        "BUY",
    )


def test_buy_with_add_note_is_buy_add():
    assert classify_trade_for_position(
        {"action": "BUY", "note": "Adding to position"}
    ) == ("held", "BUY-Add")


def test_sell_close_marks_position_closed():
    # Real close phrasing from the trade log ("stop hit" / "close").
    assert classify_trade_for_position(
        {"action": "SELL", "ticker": "X", "note": "Stop hit, closing position"}
    ) == ("closed", "SELL-Close")


def test_sell_trim_keeps_position_held():
    assert classify_trade_for_position(
        {"action": "SELL", "ticker": "X", "note": "Trimming half the position"}
    ) == ("held", "SELL-Trim")


def test_ambiguous_sell_is_skipped():
    assert (
        classify_trade_for_position(
            {"action": "SELL", "ticker": "X", "note": "rebalancing"}
        )
        is None
    )


@pytest.mark.parametrize("action", ["HEDGE", "COVER-HEDGE"])
def test_hedges_are_skipped(action):
    assert classify_trade_for_position({"action": action, "note": ""}) is None


def test_unknown_action_is_skipped():
    assert classify_trade_for_position({"action": "SPLIT", "note": ""}) is None


# ── Upstream payload parsing (notification_to_row) ──────────────────────────


def test_notification_to_row_maps_fields_and_scales_price():
    item = {
        "notification": {
            "id": "abc123",
            "created_at": "2026-05-18T16:42:16.000000Z",
            "ticker": "NVDA",
            "type": "BUY",
            "price": 22574,  # integer cents
            "stop_notes": "Adding",
        }
    }
    row = notification_to_row(item, "Knox Ridley")
    assert row == {
        "id": "iof:abc123",
        "trade_date": "2026-05-18",
        "ticker": "NVDA",
        "action": "BUY",
        "price": 225.74,
        "note": "Adding",
        "analyst": "Knox Ridley",
    }


def test_notification_to_row_returns_none_when_required_field_missing():
    item = {"notification": {"id": "x", "ticker": "NVDA", "type": "BUY"}}  # no created_at
    assert notification_to_row(item, None) is None


def test_notification_to_row_keeps_zero_price():
    item = {
        "notification": {
            "id": "z",
            "created_at": "2026-01-01T00:00:00.000000Z",
            "ticker": "T",
            "type": "BUY",
            "price": 0,
        }
    }
    row = notification_to_row(item, None)
    assert row is not None and row["price"] == 0


# ── __NEXT_DATA__ extraction (extract_page) ─────────────────────────────────


def test_extract_page_pulls_notifications_and_analyst():
    payload = {
        "props": {
            "pageProps": {
                "notifications": [{"notification": {"id": "1"}}],
                "author": {"data": {"name": "Knox Ridley"}},
            }
        }
    }
    html = (
        '<html><body><script id="__NEXT_DATA__" type="application/json">'
        + json.dumps(payload)
        + "</script></body></html>"
    )
    notifications, analyst = extract_page(html)
    assert analyst == "Knox Ridley"
    assert notifications == [{"notification": {"id": "1"}}]


def test_extract_page_collapses_richtext_author_name():
    payload = {
        "props": {
            "pageProps": {
                "notifications": [],
                "author": {"data": {"name": [{"text": "Knox "}, {"text": "Ridley"}]}},
            }
        }
    }
    html = (
        '<script id="__NEXT_DATA__" type="application/json">'
        + json.dumps(payload)
        + "</script>"
    )
    _, analyst = extract_page(html)
    assert analyst == "Knox Ridley"
