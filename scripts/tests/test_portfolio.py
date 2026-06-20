"""Behavior tests for the portfolio-PDF pure logic (scripts/ingest_portfolio.py).

No network/PDF download: the parser runs against a captured slice of real
extracted table text (tests/fixtures/portfolio_table.txt). These pin the
theme taxonomy, ticker anchoring, weight extraction, and the pre-write guard
that protects the authoritative positions table.
"""

from pathlib import Path

import pytest

from ingest_portfolio import normalize_theme, parse_portfolio, validate

FIXTURE = (Path(__file__).parent / "fixtures" / "portfolio_table.txt").read_text()
# Includes GOOG alongside GOOGL to prove longest-prefix-wins anchoring.
KNOWN = {"ALAB", "AMD", "BTCUSD", "GOOG", "GOOGL", "MU", "NVDA", "LINKUSD"}


# ── Theme taxonomy (normalize_theme) ────────────────────────────────────────


def test_accelerator_maps_to_accelerators():
    assert normalize_theme("AI Accelerator") == "AI Accelerators"


def test_keyword_order_accelerator_beats_semis():
    # NVDA's theme leads with "Semis/AI Accelerator…"; accelerat must win.
    assert normalize_theme("Semis/AI Accelerator,EV") == "AI Accelerators"


def test_semiconductors_maps_to_ai_semis():
    assert normalize_theme("Semiconductors") == "AI Semis"


def test_crypto_compound_maps_to_cryptocurrency():
    assert normalize_theme("Cryptocurrency/Store of Value") == "Cryptocurrency"


def test_unknown_theme_falls_back_to_first_segment():
    assert normalize_theme("Off Chain Smart Contracts") == "Off Chain Smart Contracts"


def test_empty_theme_is_none():
    assert normalize_theme("") is None


# ── Table parsing (parse_portfolio) ─────────────────────────────────────────


def _by_ticker():
    return {r["ticker"]: r for r in parse_portfolio(FIXTURE, KNOWN)}


def test_header_row_is_skipped_and_all_holdings_parsed():
    rows = parse_portfolio(FIXTURE, KNOWN)
    assert {r["ticker"] for r in rows} == {
        "ALAB",
        "AMD",
        "BTCUSD",
        "GOOGL",
        "MU",
        "NVDA",
        "LINKUSD",
    }


def test_longest_prefix_ticker_wins():
    # head "GOOGL Alphabet…" starts with both GOOG and GOOGL → GOOGL.
    assert "GOOGL" in _by_ticker() and "GOOG" not in _by_ticker()


def test_glued_ticker_is_anchored_and_stripped_from_company():
    # Fixture line is "NVDANVIDIA CorpLong-Term…" (live PDF glues ticker+company).
    nvda = _by_ticker()["NVDA"]
    assert nvda["company"] == "NVIDIA Corp"


def test_allocation_is_first_percentage():
    by = _by_ticker()
    assert by["MU"]["weight"] == 14.0
    assert by["ALAB"]["weight"] == 7.0
    assert by["LINKUSD"]["weight"] == 1.0


def test_theme_normalized_per_row():
    by = _by_ticker()
    assert by["ALAB"]["category"] == "AI Networking"
    assert by["BTCUSD"]["category"] == "Cryptocurrency"
    assert by["NVDA"]["category"] == "AI Accelerators"  # the order trap
    assert by["LINKUSD"]["category"] == "Off Chain Smart Contracts"


# ── Pre-write guard (validate) ──────────────────────────────────────────────


def _rows(n, weight=10.0):
    return [{"ticker": f"T{i}", "weight": weight} for i in range(n)]


def test_validate_passes_on_healthy_book():
    validate(_rows(10, 10.0))  # 10 rows, sums to 100 — no raise


def test_validate_rejects_too_few_rows():
    with pytest.raises(SystemExit):
        validate(_rows(5, 10.0))


def test_validate_rejects_allocation_sum_out_of_range():
    with pytest.raises(SystemExit):
        validate(_rows(10, 5.0))  # sums to 50%


def test_validate_rejects_missing_weight():
    rows = _rows(10, 10.0)
    rows[0]["weight"] = None  # sum still 90 (in range), per-row guard must catch
    with pytest.raises(SystemExit):
        validate(rows)
