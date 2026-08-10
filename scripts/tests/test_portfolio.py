"""Behavior tests for the portfolio-PDF pure logic (scripts/ingest_portfolio.py).

No network/PDF download: the parser runs against a captured slice of real
extracted table text (tests/fixtures/portfolio_table.txt). These pin the
theme taxonomy, ticker anchoring, weight extraction, and the pre-write guard
that protects the authoritative positions table.
"""

from pathlib import Path

import pytest

from ingest_portfolio import (
    match_table_pdf_url,
    normalize_theme,
    parse_portfolio,
    validate,
)

FIXTURE = (Path(__file__).parent / "fixtures" / "portfolio_table.txt").read_text()
# Includes GOOG alongside GOOGL to prove longest-prefix-wins anchoring.
KNOWN = {"ALAB", "AMD", "BTCUSD", "GOOG", "GOOGL", "MU", "NVDA", "LINKUSD", "STX", "META"}

# Advanced layout (2026-08 rebrand): layout-mode extraction of the
# "AdvancedPortfolio.pdf" table. NET's allocation cell is hand-blanked in the
# fixture to pin the unsized-newcomer case. The junk entries mirror real
# trades-table noise that must never anchor a row.
ADVANCED_FIXTURE = (
    Path(__file__).parent / "fixtures" / "portfolio_table_advanced.txt"
).read_text()
ADVANCED_KNOWN = {
    "AAOI", "AMD", "CRDO", "ALAB", "MTSI", "NET", "NVDA", "STX", "WDC",
    "S", "*", "TEST",  # junk from early trades rows
}


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
        "STX",
        "META",
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


def test_blank_allocation_is_none_not_a_gain():
    # New positions ship a blank Allocation cell. STX's line glues an entry
    # gain onto the prices ("$816.99799.982.1%") — the % after the first $
    # must NOT be read as a weight. META's line has no % at all.
    by = _by_ticker()
    assert by["STX"]["weight"] is None
    assert by["META"]["weight"] is None
    assert by["STX"]["category"] == "AI Memory"
    assert by["META"]["category"] == "AI Software"


def test_theme_normalized_per_row():
    by = _by_ticker()
    assert by["ALAB"]["category"] == "AI Networking"
    assert by["BTCUSD"]["category"] == "Cryptocurrency"
    assert by["NVDA"]["category"] == "AI Accelerators"  # the order trap
    assert by["LINKUSD"]["category"] == "Off Chain Smart Contracts"


# ── Advanced table layout (2026-08) ─────────────────────────────────────────


def _adv_by_ticker():
    return {r["ticker"]: r for r in parse_portfolio(ADVANCED_FIXTURE, ADVANCED_KNOWN)}


def test_advanced_all_rows_parsed_and_junk_never_anchors():
    # Footer prose ("Stocks are volatile…", "*New positions…") must not anchor
    # the junk known-tickers "S" / "*" / "TEST".
    rows = parse_portfolio(ADVANCED_FIXTURE, ADVANCED_KNOWN)
    assert {r["ticker"] for r in rows} == {
        "AAOI", "AMD", "CRDO", "ALAB", "MTSI", "NET", "NVDA", "STX", "WDC",
    }


def test_advanced_allocation_sits_between_mktcap_and_type():
    # A first-%-anywhere read would grab an entry gain; a %-before-first-$
    # read (the legacy rule) finds nothing because market cap is "$9.9B".
    by = _adv_by_ticker()
    assert by["AAOI"]["weight"] == 9.6
    assert by["NVDA"]["weight"] == 0.2
    assert by["MTSI"]["weight"] == 5.0


def test_advanced_blank_allocation_is_none_not_a_gain():
    # NET's allocation cell is blank; its 1.2% entry gain must not be read.
    assert _adv_by_ticker()["NET"]["weight"] is None


def test_advanced_wrapped_company_joins_continuation_line():
    by = _adv_by_ticker()
    assert by["CRDO"]["company"] == "Credo Technology Group Holding Ltd."
    assert by["MTSI"]["company"] == "MACOM Technology Solutions Holdings, Inc."
    assert by["STX"]["company"] == "Seagate Technology Holdings Plc"


def test_advanced_last_row_ignores_footer_block():
    # The blank line after the last row keeps the hedge/footnote block from
    # being appended as a company continuation.
    assert _adv_by_ticker()["WDC"]["company"] == "Western Digital Corp."


def test_advanced_microtrend_is_the_category():
    by = _adv_by_ticker()
    assert by["AAOI"]["category"] == "AI Networking"
    assert by["AMD"]["category"] == "AI Accelerators"
    assert by["STX"]["category"] == "AI Memory"


# ── PDF URL discovery (match_table_pdf_url) ─────────────────────────────────


def test_url_matches_current_advanced_name():
    html = 'x "https://cdn.prismic.io/x/Cuv2slgwytCO4vzd_AdvancedPortfolio.pdf" y'
    assert match_table_pdf_url(html) == (
        "https://cdn.prismic.io/x/Cuv2slgwytCO4vzd_AdvancedPortfolio.pdf"
    )


def test_url_matches_legacy_versioned_name():
    html = 'x "https://cdn.prismic.io/x/abc_Portfolio_v3-Portfolio.pdf" y'
    assert match_table_pdf_url(html) == (
        "https://cdn.prismic.io/x/abc_Portfolio_v3-Portfolio.pdf"
    )


def test_url_ignores_pie_chart_history_and_absence():
    html = (
        '"https://cdn.prismic.io/x/a_AdvancedPieChart.pdf" '
        '"https://cdn.prismic.io/x/b_Portfolio_v3-History.pdf"'
    )
    assert match_table_pdf_url(html) is None
    assert match_table_pdf_url("no pdfs at all") is None


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


def test_validate_allows_blank_weights_for_new_positions():
    # 10 allocated rows summing to 100 plus 2 unsized newcomers — no raise.
    rows = _rows(10, 10.0) + [
        {"ticker": "NEW1", "weight": None},
        {"ticker": "NEW2", "weight": None},
    ]
    validate(rows)


def test_validate_rejects_mostly_blank_parse():
    # A parse that loses most weights is garbled, not a book of newcomers.
    rows = _rows(12, 10.0)
    for r in rows[:6]:
        r["weight"] = None
    with pytest.raises(SystemExit):
        validate(rows)
