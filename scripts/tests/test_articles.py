"""Pure tests for member-API post mapping and distillation-output parsing."""

import json
from pathlib import Path

import pytest

from ingest_articles import html_to_text, parse_frontmatter, post_to_item

FM = "---\nurl: https://io-fund.com/premium/example\ntitle: Example\n---\n"
BODY = "## Thesis\nExample thesis.\n\n## Key numbers\n- One: 1"
POSTS = json.loads(
    (Path(__file__).parent / "fixtures" / "posts_page.json").read_text()
)["data"]


def test_post_to_item_prefixes_url_and_derives_free_plan_fields():
    item = post_to_item(POSTS[0])
    assert item is not None
    assert item["url"] == "https://io-fund.com/ai-stocks/synthetic-networking-overview"
    assert item["slug"] == "synthetic-networking-overview"
    assert item["pub_date"] == "2026-08-20"
    assert item["category"] == "ai-stocks"
    assert item["plan"] == "free"
    assert item["premium"] is False


def test_post_to_item_marks_advance_post_premium():
    item = post_to_item(POSTS[1])
    assert item is not None
    assert item["category"] == "premium"
    assert item["plan"] == "advance"
    assert item["premium"] is True


def test_post_to_item_filters_drafts_and_administrative_titles():
    assert post_to_item(POSTS[2]) is None
    assert post_to_item(POSTS[3]) is None


def test_post_to_item_filters_malformed_date_or_relative_url():
    assert post_to_item({**POSTS[0], "date": "not-a-date"}) is None
    assert post_to_item({**POSTS[0], "url": "https://example.test/post"}) is None


def test_wordpress_block_html_becomes_clean_paragraphs():
    item = post_to_item(POSTS[0])
    assert item is not None
    assert html_to_text(item["content_html"]) == (
        "A fictional networking supplier increased test revenue by 18%.\n"
        "Outlook\n"
        "Management expects another synthetic product cycle next year."
    )


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
