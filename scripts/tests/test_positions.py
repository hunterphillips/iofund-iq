"""Behavior tests for the trade-ingest pure logic (scripts/ingest_trades.py).

These are characterization tests over public functions — no DB, no network, no
LLM. They pin the rules that decide a position's held/closed status.
"""

import pytest

from ingest_trades import classify_trade_for_position


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
