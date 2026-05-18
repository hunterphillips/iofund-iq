#!/usr/bin/env bash
# pdf-extract.sh — print PDF text to stdout. Tries pdftotext, falls back to pypdf.
set -euo pipefail

PDF="${1:-}"
PAGES="${2:-}"

if [[ -z "$PDF" ]]; then
  echo "Usage: pdf-extract.sh <pdf-path> [pages]" >&2
  echo "  pages: N or N-M (1-indexed). Omit for whole document." >&2
  exit 1
fi

if [[ ! -f "$PDF" ]]; then
  echo "Error: file not found: $PDF" >&2
  exit 1
fi

parse_pages() {
  if [[ "$1" =~ ^([0-9]+)-([0-9]+)$ ]]; then
    PAGE_FIRST="${BASH_REMATCH[1]}"
    PAGE_LAST="${BASH_REMATCH[2]}"
  elif [[ "$1" =~ ^([0-9]+)$ ]]; then
    PAGE_FIRST="${BASH_REMATCH[1]}"
    PAGE_LAST="${BASH_REMATCH[1]}"
  else
    echo "Error: invalid pages format: $1 (expected N or N-M)" >&2
    exit 1
  fi
}

if command -v pdftotext &>/dev/null; then
  if [[ -n "$PAGES" ]]; then
    parse_pages "$PAGES"
    pdftotext -layout -f "$PAGE_FIRST" -l "$PAGE_LAST" "$PDF" -
  else
    pdftotext -layout "$PDF" -
  fi
  exit 0
fi

if ! python3 -c "import pypdf" 2>/dev/null; then
  echo "[pdf-extract] pypdf not found — installing to user site-packages..." >&2
  if ! python3 -m pip install --user --quiet --break-system-packages pypdf 2>/dev/null; then
    python3 -m pip install --user --quiet pypdf
  fi
fi

PAGES_ARG="$PAGES" python3 - "$PDF" <<'PY'
import os, sys
from pypdf import PdfReader

path = sys.argv[1]
pages_arg = os.environ.get("PAGES_ARG", "")
reader = PdfReader(path)
total = len(reader.pages)

if not pages_arg:
    start, end = 1, total
elif "-" in pages_arg:
    a, b = pages_arg.split("-", 1)
    start, end = int(a), int(b)
else:
    start = end = int(pages_arg)

start = max(1, start)
end = min(total, end)

for i in range(start, end + 1):
    print(f"--- Page {i} ---")
    text = reader.pages[i - 1].extract_text() or ""
    print(text)
    print()
PY
