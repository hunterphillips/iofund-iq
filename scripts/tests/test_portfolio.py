"""Pure tests for the Sheets-backed portfolio API parser and guards."""

import json
from decimal import Decimal
from pathlib import Path

import pytest

from ingest_portfolio import (
    normalize_theme,
    parse_entry_date,
    parse_entry_price,
    parse_sheet,
    validate,
)

FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "portfolio_sheet.json").read_text()
)["data"]
KNOWN = {f"SYN{i}" for i in range(1, 11)} | {"*", "TEST"}


def _parsed():
    return parse_sheet(FIXTURE, KNOWN)


def test_parse_sheet_classifies_positions_continuations_and_new_rows():
    positions, unresolved = _parsed()
    assert [row["ticker"] for row in positions] == [f"SYN{i}" for i in range(1, 11)]
    assert len(unresolved) == 1
    assert unresolved[0] == {
        "company": None,
        "weight": 3.7,
        "category": "AI Semis",
        "first_entry": "$42.50",
        "date_of_entry": "8/24/26",
    }


def test_parse_sheet_cleans_na_and_preserves_unsized_position():
    positions, _ = _parsed()
    by_ticker = {row["ticker"]: row for row in positions}
    assert by_ticker["SYN3"]["company"] is None
    assert by_ticker["SYN10"]["weight"] == 8.0


def test_parse_sheet_anchors_to_known_tickers_and_skips_junk():
    positions, _ = _parsed()
    assert "DISCLAIMER" not in {row["ticker"] for row in positions}
    assert "*" not in {row["ticker"] for row in positions}


def test_entry_parsers_cover_sheet_formats_and_bad_cells():
    assert parse_entry_date("8/24/26").isoformat() == "2026-08-24"
    assert parse_entry_date("#N/A") is None
    assert parse_entry_price("$1,234.50") == Decimal("1234.50")
    assert parse_entry_price("not available") is None


def test_accelerator_beats_semis_in_compound_theme():
    assert normalize_theme("Semis/AI Accelerator") == "AI Accelerators"


def test_semi_equipment_maps_to_ai_semis():
    assert normalize_theme("AI Semi Equipment") == "AI Semis"


def test_other_theme_mappings_and_fallback():
    assert normalize_theme("Semiconductors") == "AI Semis"
    assert normalize_theme("Cryptocurrency/Store of Value") == "Cryptocurrency"
    assert normalize_theme("Off Chain Smart Contracts") == "Off Chain Smart Contracts"
    assert normalize_theme("") is None


def _rows(count: int, weight: float = 10.0) -> list[dict]:
    return [{"ticker": f"T{i}", "weight": weight} for i in range(count)]


def test_fixture_validates_with_resolved_new_position():
    positions, unresolved = _parsed()
    validate(positions + [{"ticker": "NEW", **unresolved[0]}])


def test_validate_counts_dropped_unresolved_weight():
    rows = _rows(10, 8.8)
    validate(rows, extra_weight=12.0)
    with pytest.raises(SystemExit):
        validate(rows)


def test_validate_rejects_too_few_rows():
    with pytest.raises(SystemExit):
        validate(_rows(5, 10.0))


def test_validate_rejects_allocation_sum_out_of_range():
    with pytest.raises(SystemExit):
        validate(_rows(10, 5.0))


def test_validate_allows_blank_weights_for_new_positions():
    rows = _rows(10, 10.0) + [
        {"ticker": "NEW1", "weight": None},
        {"ticker": "NEW2", "weight": None},
    ]
    validate(rows)


def test_validate_rejects_mostly_blank_parse():
    rows = _rows(12, 10.0)
    for row in rows[:6]:
        row["weight"] = None
    with pytest.raises(SystemExit):
        validate(rows)
