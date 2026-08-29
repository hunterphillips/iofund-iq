"""Tests for ingest_articles' pure distillation-output parsing."""

import pytest

from ingest_articles import parse_frontmatter

FM = "---\nurl: https://io-fund.com/premium/example\ntitle: Example\n---\n"
BODY = "## Thesis\nExample thesis.\n\n## Key numbers\n- One: 1"


def test_plain_output():
    fm, body = parse_frontmatter(FM + BODY)
    assert fm["title"] == "Example"
    assert body == BODY


def test_whole_output_fenced():
    fm, body = parse_frontmatter(f"```markdown\n{FM}{BODY}\n```")
    assert fm["title"] == "Example"
    assert body == BODY


def test_frontmatter_only_fenced():
    # The shape that shipped 7 broken articles (2026-08): the model fences
    # just the frontmatter, so its closing ``` used to survive as the body's
    # first line and turn the whole article into one code block.
    fm, body = parse_frontmatter(f"```markdown\n{FM}```\n\n{BODY}")
    assert fm["title"] == "Example"
    assert body == BODY


def test_no_frontmatter_raises():
    with pytest.raises(ValueError):
        parse_frontmatter(BODY)
